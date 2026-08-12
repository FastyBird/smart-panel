import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import {
	ConfigChangeResult,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import {
	DEVICES_WLED_PLUGIN_NAME,
	DEVICES_WLED_TYPE,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-wled.constants';
import { WledValidationException } from '../devices-wled.exceptions';
import { UpdateWledDeviceDto } from '../dto/update-device.dto';
import { WledAdoptDeviceDto } from '../dto/wled-adoption.dto';
import { WledDeviceEntity } from '../entities/devices-wled.entity';
import {
	WledDeviceConnectedEvent,
	WledDeviceContext,
	WledDeviceDisconnectedEvent,
	WledDeviceErrorEvent,
	WledDeviceStateChangedEvent,
	WledMdnsDiscoveredDevice,
} from '../interfaces/wled.interface';
import { WledConfigModel } from '../models/config.model';
import { WledAdoptionResultModel, WledDiscoveredDeviceModel, WledDiscoveryModel } from '../models/wled-discovery.model';

import { WledAdoptionSnapshotService, WledAdoptionStructureSnapshot } from './adoption-snapshot.service';
import { WledDeviceMapperService } from './device-mapper.service';
import { WledClientAdapterService } from './wled-client-adapter.service';
import { WledMdnsDiscovererService } from './wled-mdns-discoverer.service';

/**
 * Main WLED Service
 *
 * Manages the lifecycle of WLED device connections, state synchronization,
 * and event handling. Implements IManagedPluginService for centralized
 * lifecycle management by PluginServiceManagerService.
 */
@Injectable()
export class WledService extends BaseManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(DEVICES_WLED_PLUGIN_NAME, 'WledService');

	readonly pluginName = DEVICES_WLED_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private pluginConfig: WledConfigModel | null = null;
	private pollingInterval: NodeJS.Timeout | null = null;
	private adoptionQueue: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly wledAdapter: WledClientAdapterService,
		private readonly deviceMapper: WledDeviceMapperService,
		private readonly adoptionSnapshot: WledAdoptionSnapshotService,
		private readonly devicesService: DevicesService,
		private readonly mdnsDiscoverer: WledMdnsDiscovererService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {
		super();

		// Set up adapter callbacks
		this.wledAdapter.setCallbacks({
			onDeviceConnected: (event) => this.handleDeviceConnected(event),
			onDeviceDisconnected: (event) => this.handleDeviceDisconnected(event),
			onDeviceStateChanged: (event) => this.handleDeviceStateChanged(event),
			onDeviceError: (event) => this.handleDeviceError(event),
		});

		// Set up mDNS discovery callbacks
		this.mdnsDiscoverer.setCallbacks({
			onDeviceDiscovered: (device) => this.handleMdnsDeviceDiscovered(device),
		});
	}

	/**
	 * Start the service.
	 * Called by PluginServiceManagerService when the plugin is enabled.
	 */
	async start(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'started':
					return;
				case 'starting':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					// Clear cached config to ensure fresh values on restart
					this.pluginConfig = null;
					await this.initialize();
					await this.doStart();
					return;
				case 'stopped':
				case 'error':
					// Clear cached config to ensure fresh values on restart
					this.pluginConfig = null;
					await this.initialize();
					await this.doStart();
					return;
			}
		});
	}

	/**
	 * Stop the service gracefully.
	 * Called by PluginServiceManagerService when the plugin is disabled or app shuts down.
	 */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					return;
				case 'starting':
					await this.waitUntil('started', 'stopped', 'error');
					if (this.getState() !== 'started') {
						return;
					}
				// fallthrough
				case 'started':
					this.doStop();
					return;
				case 'error':
					this.doStop();
					return;
			}
		});
	}

	/**
	 * Handle configuration changes.
	 * Called by PluginServiceManagerService when config updates occur.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		// Check if config values actually changed for THIS plugin
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<WledConfigModel>(DEVICES_WLED_PLUGIN_NAME);

			// Compare relevant settings that would require restart
			const configChanged =
				oldConfig.polling.interval !== newConfig.polling.interval ||
				oldConfig.websocket.enabled !== newConfig.websocket.enabled ||
				oldConfig.websocket.reconnectInterval !== newConfig.websocket.reconnectInterval ||
				oldConfig.mdns.enabled !== newConfig.mdns.enabled ||
				oldConfig.mdns.interface !== newConfig.mdns.interface ||
				oldConfig.mdns.autoAdd !== newConfig.mdns.autoAdd ||
				oldConfig.timeouts.connectionTimeout !== newConfig.timeouts.connectionTimeout ||
				oldConfig.timeouts.commandDebounce !== newConfig.timeouts.commandDebounce;

			if (configChanged) {
				this.logger.log('Config changed, restart required');
				return Promise.resolve({ restartRequired: true });
			}

			// Config didn't change for this plugin, no restart needed
			this.logger.debug('Config event received but no relevant changes for this plugin');
			return Promise.resolve({ restartRequired: false });
		}

		// Clear config only if not running (no handlers active)
		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	/**
	 * Restart the service through the PluginServiceManagerService.
	 */
	async restart(): Promise<void> {
		const success = await this.pluginServiceManager.restartService(this.pluginName, this.serviceId);

		if (!success) {
			this.logger.debug('Restart skipped (plugin may be disabled)');
		}
	}

	/**
	 * Initialize device states before starting
	 */
	private async initialize(): Promise<void> {
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);

		for (const device of devices) {
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.UNKNOWN,
			});
		}
	}

	/**
	 * Perform the actual start logic
	 */
	private async doStart(): Promise<void> {
		this.state = 'starting';

		this.logger.log('Starting WLED plugin service');

		try {
			// Configure WebSocket
			this.wledAdapter.configureWebSocket(this.config.websocket.enabled, this.config.websocket.reconnectInterval);

			// Connect to enabled WLED devices from database
			await this.connectToDatabaseDevices();

			// Start mDNS discovery if enabled
			this.startMdnsDiscovery();

			// Start state polling
			this.startPolling();

			this.logger.log('WLED plugin service started successfully');
			this.state = 'started';
		} catch (error) {
			this.logger.error('Failed to start WLED plugin service', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			this.state = 'error';
			throw error;
		}
	}

	/**
	 * Perform the actual stop logic
	 */
	private doStop(): void {
		this.state = 'stopping';

		this.logger.log('Stopping WLED plugin service');

		try {
			// Stop polling
			this.stopPolling();

			// Stop mDNS discovery
			this.mdnsDiscoverer.stop();

			// Disconnect all devices
			this.wledAdapter.disconnectAll();

			this.logger.log('WLED plugin service stopped');
			this.state = 'stopped';
		} catch (error) {
			this.logger.error('Failed to stop WLED plugin service', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			this.state = 'stopped';
		}
	}

	/**
	 * Connect to all enabled WLED devices from database
	 */
	private async connectToDatabaseDevices(): Promise<void> {
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const enabledDevices = devices.filter((d) => d.enabled && d.hostname);

		if (enabledDevices.length === 0) {
			this.logger.log('No enabled WLED devices found in database');
			return;
		}

		this.logger.log(`Connecting to ${enabledDevices.length} enabled WLED device(s)`);

		for (const device of enabledDevices) {
			await this.connectToDevice(device);
		}
	}

	/**
	 * Connect to a single WLED device
	 */
	private async connectToDevice(device: WledDeviceEntity): Promise<void> {
		if (!device.hostname || !device.identifier) {
			this.logger.warn(`Device ${device.id} missing hostname or identifier, skipping`, { resource: device.id });
			return;
		}

		try {
			this.logger.debug(`Connecting to WLED device at ${device.hostname}`, { resource: device.id });

			await this.wledAdapter.connect(device.hostname, device.identifier, this.config.timeouts.connectionTimeout);

			// Get the device context and update state
			const registeredDevice = this.wledAdapter.getDevice(device.hostname);

			if (registeredDevice?.context) {
				await this.deviceMapper.updateDeviceState(device.identifier, registeredDevice.context.state);
			}
		} catch (error) {
			this.logger.error(`Failed to connect to WLED device at ${device.hostname}`, {
				resource: device.id,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device connected event
	 */
	private async handleDeviceConnected(event: WledDeviceConnectedEvent): Promise<void> {
		this.logger.log(`Device connected: ${event.host} (${event.info.name})`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.setDeviceConnectionState(device.identifier, ConnectionState.CONNECTED);
		}
	}

	/**
	 * Handle device disconnected event
	 */
	private async handleDeviceDisconnected(event: WledDeviceDisconnectedEvent): Promise<void> {
		this.logger.log(`Device disconnected: ${event.host} (${event.reason || 'unknown reason'})`);

		await this.deviceMapper.setDeviceConnectionState(event.identifier, ConnectionState.DISCONNECTED);
	}

	/**
	 * Handle device state changed event
	 */
	private async handleDeviceStateChanged(event: WledDeviceStateChangedEvent): Promise<void> {
		this.logger.debug(`Device state changed: ${event.host}`);

		const device = this.wledAdapter.getDevice(event.host);

		if (device) {
			await this.deviceMapper.updateDeviceState(device.identifier, event.state);
		}
	}

	/**
	 * Handle device error event
	 */
	private handleDeviceError(event: WledDeviceErrorEvent): void {
		this.logger.error(`Device error: ${event.host}`, {
			message: event.error.message,
		});
	}

	/**
	 * Start state polling
	 */
	private startPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}

		const interval = this.config.polling.interval;

		this.logger.debug(`Starting state polling with interval: ${interval}ms`);

		this.pollingInterval = setInterval(() => {
			void this.pollDeviceStates();
		}, interval);
	}

	/**
	 * Stop state polling
	 */
	private stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * Poll state from all connected devices
	 */
	private async pollDeviceStates(): Promise<void> {
		if (this.state !== 'started') {
			return;
		}

		const devices = this.wledAdapter.getRegisteredDevices();

		for (const device of devices) {
			if (!device.enabled || !device.connected) {
				continue;
			}

			try {
				await this.wledAdapter.refreshState(device.host, this.config.timeouts.connectionTimeout);
			} catch (error) {
				this.logger.warn(`Failed to poll state from device ${device.host}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	/**
	 * Periodic state refresh (every 5 minutes as a backup to polling)
	 */
	@Cron(CronExpression.EVERY_5_MINUTES)
	private async periodicStateRefresh(): Promise<void> {
		if (this.state !== 'started') {
			return;
		}

		this.logger.debug('Running periodic state refresh');

		await this.pollDeviceStates();
	}

	/**
	 * Start mDNS discovery if enabled
	 */
	private startMdnsDiscovery(): void {
		if (!this.config.mdns.enabled) {
			this.logger.debug('mDNS discovery is disabled');
			return;
		}

		try {
			this.mdnsDiscoverer.start(this.config.mdns.interface ?? undefined);
			this.logger.log('mDNS discovery started');
		} catch (error) {
			this.logger.error('Failed to start mDNS discovery', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle mDNS device discovered event
	 */
	private async handleMdnsDeviceDiscovered(device: WledMdnsDiscoveredDevice): Promise<void> {
		this.logger.log(`mDNS discovered device: ${device.name} at ${device.host}`);
		const endpoint = this.discoveryEndpoint(device.host, device.port);
		const advertisedMac = this.normalizeMac(device.mac) ? device.mac : undefined;

		// Check if we already have this device configured by hostname
		let devices: WledDeviceEntity[];
		try {
			devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		} catch (error) {
			this.mdnsDiscoverer.forgetDiscoveredDevice(device.host);
			this.logger.error(`Could not inspect discovered WLED device at ${endpoint}`, {
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		let identifiedDevice = { ...device, mac: advertisedMac };
		let existingDevice = this.findExistingDevice(devices, endpoint, advertisedMac);

		if (!existingDevice && !advertisedMac && !this.config.mdns.autoAdd) {
			try {
				const context = await this.wledAdapter.probe(endpoint, this.config.timeouts.connectionTimeout);
				identifiedDevice = { ...device, mac: context.info.mac };
				existingDevice = this.findExistingDevice(devices, endpoint, context.info.mac);
			} catch (error) {
				this.mdnsDiscoverer.forgetDiscoveredDevice(device.host);
				this.logger.debug(`Could not identify MAC-less WLED device at ${endpoint}`, {
					message: error instanceof Error ? error.message : String(error),
				});
				return;
			}
		}

		if (existingDevice) {
			this.logger.debug(`Device at ${endpoint} already exists in database`);
			const identityUpgradeRequired = this.requiresCanonicalIdentity(existingDevice, endpoint, identifiedDevice.mac);

			// Reconcile a known MAC at a new endpoint through the same guarded
			// provisioning path as administrator adoption. Legacy same-endpoint
			// identities use it too so a later address move remains recognizable.
			if (
				identityUpgradeRequired ||
				(existingDevice.hostname && !this.endpointsEquivalent(existingDevice.hostname, endpoint))
			) {
				await this.connectAndMapDiscoveredDevice(identifiedDevice);
			} else if (existingDevice.enabled && !this.wledAdapter.isConnected(endpoint)) {
				this.logger.debug(`Connecting to existing device at ${endpoint}`);
				await this.connectToDevice(existingDevice);
			}
			return;
		}

		// Auto-add device if enabled
		if (this.config.mdns.autoAdd) {
			this.logger.log(`Auto-adding discovered device: ${device.name} at ${device.host}`);
			await this.connectAndMapDiscoveredDevice(device);
		} else {
			this.logger.log(`Discovered device ${device.name} at ${device.host} - auto-add disabled, add manually`);
		}
	}

	/**
	 * Connect to a newly discovered device and map it to the database
	 */
	private async connectAndMapDiscoveredDevice(device: WledMdnsDiscoveredDevice): Promise<void> {
		await this.enqueueProvisioning(async () => {
			try {
				const endpoint = this.discoveryEndpoint(device.host, device.port);
				const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
				const existingDevice = this.findExistingDevice(devices, endpoint, device.mac);
				if (
					existingDevice?.hostname &&
					this.endpointsEquivalent(existingDevice.hostname, endpoint) &&
					!this.requiresCanonicalIdentity(existingDevice, endpoint, device.mac)
				) {
					if (existingDevice.enabled && !this.wledAdapter.isConnected(endpoint)) {
						await this.connectToDevice(existingDevice);
					}
					return;
				}

				const [result] = await this.doAdoptDevices([
					{
						host: endpoint,
						name: existingDevice?.name ?? device.name,
						category: DeviceCategory.LIGHTING,
					},
				]);
				if (!result || result.status === 'failed') {
					this.mdnsDiscoverer.forgetDiscoveredDevice(device.host);
					this.logger.warn(`Auto-add failed for discovered WLED device at ${endpoint}`, {
						message: result?.error ?? 'No adoption result was returned',
					});
				}
			} catch (error) {
				this.mdnsDiscoverer.forgetDiscoveredDevice(device.host);
				this.logger.error(`Failed to connect to discovered device at ${device.host}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		});
	}

	/**
	 * Get discovered devices from mDNS
	 */
	getDiscoveredDevices(): WledMdnsDiscoveredDevice[] {
		return this.mdnsDiscoverer.getDiscoveredDevices();
	}

	async getDiscoveryInventory(): Promise<WledDiscoveryModel> {
		const [discoveredDevices, databaseDevices] = await Promise.all([
			Promise.resolve(this.mdnsDiscoverer.getDiscoveredDevices()),
			this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE),
		]);

		return {
			mdnsEnabled: this.config.mdns.enabled,
			discoveryRunning: this.mdnsDiscoverer.isDiscoveryRunning(),
			devices: discoveredDevices.map((device) => {
				const discoveryEndpoint = this.discoveryEndpoint(device.host, device.port);
				const existingDevice = this.findExistingDevice(databaseDevices, discoveryEndpoint, device.mac);

				return {
					host: device.host,
					name: existingDevice?.name ?? device.name,
					mac: device.mac ?? null,
					port: device.port,
					adoptedDeviceId: existingDevice?.id ?? null,
				};
			}),
		};
	}

	async probeDevice(host: string): Promise<WledDiscoveredDeviceModel> {
		const normalizedHost = this.normalizeHost(host);
		const context = await this.wledAdapter.probe(normalizedHost, this.config.timeouts.connectionTimeout);
		const databaseDevices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const existingDevice = this.findExistingDevice(databaseDevices, normalizedHost, context.info.mac);

		return {
			host: normalizedHost,
			name: existingDevice?.name || context.info.name || `WLED ${context.info.mac}`,
			mac: context.info.mac,
			port: this.portFromHost(normalizedHost),
			adoptedDeviceId: existingDevice?.id ?? null,
		};
	}

	async rescanDiscovery(): Promise<WledDiscoveryModel> {
		this.mdnsDiscoverer.clearDiscoveredDevices();

		if (this.config.mdns.enabled) {
			this.mdnsDiscoverer.stop();
			this.mdnsDiscoverer.start(this.config.mdns.interface ?? undefined);
		}

		return this.getDiscoveryInventory();
	}

	async adoptDevices(requests: WledAdoptDeviceDto[]): Promise<WledAdoptionResultModel[]> {
		return this.enqueueProvisioning(() => this.doAdoptDevices(requests));
	}

	private async doAdoptDevices(requests: WledAdoptDeviceDto[]): Promise<WledAdoptionResultModel[]> {
		const results = requests.map<WledAdoptionResultModel | undefined>(() => undefined);
		const databaseDevices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const failedSelectionHosts = new Set<string>();
		const plans: Array<{
			index: number;
			request: WledAdoptDeviceDto;
			host: string;
			context: WledDeviceContext;
			existingDevice: WledDeviceEntity | null;
			identifier: string;
		}> = [];
		const plannedIdentities = new Set<string>();

		for (const [index, request] of requests.entries()) {
			let host = request.host.trim();

			try {
				host = this.normalizeHost(request.host);
				const context = await this.wledAdapter.probe(host, this.config.timeouts.connectionTimeout);
				const existingDevice = this.findExistingDevice(databaseDevices, host, context.info.mac);
				const canonicalIdentity = this.identifierFromMac(context.info.mac);
				const existingIdentifier = existingDevice?.identifier;
				const identifier =
					existingIdentifier &&
					!this.legacyHostIdentifiers(existingDevice.hostname ?? host).has(existingIdentifier.toLowerCase()) &&
					existingIdentifier.toLowerCase() !== `wled-${canonicalIdentity.slice(-6)}`
						? existingIdentifier
						: canonicalIdentity;

				if (plannedIdentities.has(canonicalIdentity)) {
					results[index] = {
						host,
						name: request.name,
						status: 'failed',
						error: 'The same WLED controller was selected more than once',
						deviceId: existingDevice?.id ?? null,
					};
					continue;
				}

				plannedIdentities.add(canonicalIdentity);

				plans.push({ index, request, host, context, existingDevice, identifier });
			} catch (error) {
				failedSelectionHosts.add(host);
				results[index] = {
					host,
					name: request.name,
					status: 'failed',
					error: error instanceof Error ? error.message : String(error),
					deviceId: null,
				};
			}
		}

		const plannedExistingDeviceIds = new Set(
			plans.flatMap(({ existingDevice }) => (existingDevice ? [existingDevice.id] : [])),
		);
		const selectedDeviceIds = plannedExistingDeviceIds;
		const moveHostEdges = new Map<string, Set<string>>();
		for (const plan of plans) {
			const sourceHost = plan.existingDevice?.hostname ? this.canonicalEndpoint(plan.existingDevice.hostname) : null;
			const targetHost = this.canonicalEndpoint(plan.host);
			if (!sourceHost || sourceHost === targetHost) {
				continue;
			}

			const sourceEdges = moveHostEdges.get(sourceHost) ?? new Set<string>();
			sourceEdges.add(targetHost);
			moveHostEdges.set(sourceHost, sourceEdges);
			const targetEdges = moveHostEdges.get(targetHost) ?? new Set<string>();
			targetEdges.add(sourceHost);
			moveHostEdges.set(targetHost, targetEdges);
		}
		const failedMoveHosts = new Set<string>();
		const pendingFailedHosts = [...failedSelectionHosts].map((host) => this.canonicalEndpoint(host));
		while (pendingFailedHosts.length > 0) {
			const currentHost = pendingFailedHosts.pop();
			if (!currentHost || failedMoveHosts.has(currentHost)) {
				continue;
			}

			failedMoveHosts.add(currentHost);
			pendingFailedHosts.push(...(moveHostEdges.get(currentHost) ?? []));
		}
		const blockedPlanIndices = new Set<number>();
		for (const plan of plans) {
			if (
				failedMoveHosts.has(this.canonicalEndpoint(plan.host)) ||
				(plan.existingDevice?.hostname !== null &&
					plan.existingDevice?.hostname !== undefined &&
					failedMoveHosts.has(this.canonicalEndpoint(plan.existingDevice.hostname)))
			) {
				blockedPlanIndices.add(plan.index);
				results[plan.index] = {
					host: plan.host,
					name: plan.request.name,
					status: 'failed',
					error: 'A related selected WLED controller could not be probed',
					deviceId: plan.existingDevice?.id ?? null,
				};
			}
		}
		const dependencyEdges = new Map<number, Set<number>>();
		for (const plan of plans.filter(({ index }) => !blockedPlanIndices.has(index))) {
			const selectedTargetOwner = plans.find(
				(candidate) =>
					candidate.existingDevice?.hostname !== null &&
					candidate.existingDevice?.hostname !== undefined &&
					this.endpointsEquivalent(candidate.existingDevice.hostname, plan.host) &&
					candidate.existingDevice.id !== plan.existingDevice?.id,
			);

			if (selectedTargetOwner) {
				const planEdges = dependencyEdges.get(plan.index) ?? new Set<number>();
				planEdges.add(selectedTargetOwner.index);
				dependencyEdges.set(plan.index, planEdges);
				const ownerEdges = dependencyEdges.get(selectedTargetOwner.index) ?? new Set<number>();
				ownerEdges.add(plan.index);
				dependencyEdges.set(selectedTargetOwner.index, ownerEdges);
			}
		}
		const dependencyGroupByIndex = new Map<number, Set<number>>();
		for (const start of dependencyEdges.keys()) {
			if (dependencyGroupByIndex.has(start)) {
				continue;
			}

			const group = new Set<number>();
			const pending = [start];
			while (pending.length > 0) {
				const current = pending.pop();
				if (current === undefined || group.has(current)) {
					continue;
				}

				group.add(current);
				pending.push(...(dependencyEdges.get(current) ?? []));
			}

			for (const member of group) {
				dependencyGroupByIndex.set(member, group);
			}
		}

		const retiredDeviceIds = new Set<string>();
		const failedDependencyGroups = new Map<Set<number>, string>();
		const createdDeviceIdsByPlan = new Map<number, string>();
		const structureSnapshotsByPlan = new Map<number, WledAdoptionStructureSnapshot>();
		const retiredStaleOwnersByDependencyGroup = new Map<Set<number>, Map<string, WledDeviceEntity>>();
		const disconnectedStaleOwnerIdsByDependencyGroup = new Map<Set<number>, Set<string>>();

		for (const { index, request, host, context, existingDevice, identifier } of plans) {
			if (blockedPlanIndices.has(index)) {
				continue;
			}

			const dependencyGroup = dependencyGroupByIndex.get(index);
			const dependencyFailure = dependencyGroup ? failedDependencyGroups.get(dependencyGroup) : undefined;
			if (dependencyFailure) {
				results[index] = {
					host,
					name: request.name,
					status: 'failed',
					error: dependencyFailure,
					deviceId: existingDevice?.id ?? null,
				};
				continue;
			}

			let mappedDevice: WledDeviceEntity | null = null;
			let existingDeviceDisconnected = false;
			let attemptedRegistrationCreated = false;
			const retiredStaleOwners: WledDeviceEntity[] = [];
			const disconnectedStaleOwners: WledDeviceEntity[] = [];

			try {
				if (existingDevice) {
					structureSnapshotsByPlan.set(index, await this.adoptionSnapshot.capture(existingDevice.id));
				}
				if (existingDevice && existingDevice.identifier !== identifier) {
					await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(existingDevice.id, {
						type: DEVICES_WLED_TYPE,
						identifier,
						hostname: host,
					});
				}
				const device = await this.deviceMapper.mapDevice(
					host,
					context,
					request.name,
					identifier,
					request.description,
					request.enabled,
				);
				mappedDevice = device;
				if (!existingDevice) {
					createdDeviceIdsByPlan.set(index, device.id);
				}
				if (existingDevice?.hostname && existingDevice.hostname !== host) {
					const sourceRegistration = this.wledAdapter.getDevice(existingDevice.hostname);

					// During a batch address swap, the previous source host may already hold
					// another successfully moved controller. Disconnect only the registration
					// that actually belongs to this device.
					if (sourceRegistration?.identifier === existingDevice.identifier) {
						this.wledAdapter.disconnect(existingDevice.hostname, false);
						existingDeviceDisconnected = true;
					}
				}
				const staleHostOwners = databaseDevices.filter(
					(device) =>
						device.hostname !== null &&
						this.endpointsEquivalent(device.hostname, host) &&
						device.id !== existingDevice?.id,
				);
				const retiringHostOwners = staleHostOwners.filter(
					(staleHostOwner) => !selectedDeviceIds.has(staleHostOwner.id) && !retiredDeviceIds.has(staleHostOwner.id),
				);
				if (dependencyGroup && retiringHostOwners.length > 0) {
					const groupOwners =
						retiredStaleOwnersByDependencyGroup.get(dependencyGroup) ?? new Map<string, WledDeviceEntity>();
					for (const staleHostOwner of staleHostOwners) {
						groupOwners.set(staleHostOwner.id, staleHostOwner);
					}
					retiredStaleOwnersByDependencyGroup.set(dependencyGroup, groupOwners);
				}
				if (staleHostOwners.length > 0) {
					for (const staleHostOwner of retiringHostOwners) {
						if (!staleHostOwner.hostname) {
							continue;
						}
						const staleRegistration = this.wledAdapter.getDevice(staleHostOwner.hostname);
						if (staleRegistration?.identifier === staleHostOwner.identifier) {
							this.wledAdapter.disconnect(staleHostOwner.hostname, false);
							if (retiringHostOwners.some(({ id }) => id === staleHostOwner.id)) {
								disconnectedStaleOwners.push(staleHostOwner);
								if (dependencyGroup) {
									const disconnectedIds =
										disconnectedStaleOwnerIdsByDependencyGroup.get(dependencyGroup) ?? new Set<string>();
									disconnectedIds.add(staleHostOwner.id);
									disconnectedStaleOwnerIdsByDependencyGroup.set(dependencyGroup, disconnectedIds);
								}
							}
						}
					}
				}
				for (const staleHostOwner of retiringHostOwners) {
					retiredStaleOwners.push(staleHostOwner);
					await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(staleHostOwner.id, {
						type: DEVICES_WLED_TYPE,
						enabled: false,
						hostname: null,
					});
					await this.deviceConnectivityService.setConnectionState(staleHostOwner.id, {
						state: ConnectionState.DISCONNECTED,
					});
					retiredDeviceIds.add(staleHostOwner.id);
				}
				let connectionState = ConnectionState.DISCONNECTED;
				if (!device.enabled) {
					this.wledAdapter.disconnect(host, false);
					existingDeviceDisconnected = existingDevice !== null;
				} else {
					const registeredDevice = this.wledAdapter.getDevice(host);

					if (registeredDevice?.identifier === identifier && registeredDevice.connected) {
						registeredDevice.context = context;
						registeredDevice.lastSeen = new Date();
						connectionState = ConnectionState.CONNECTED;
					} else {
						try {
							this.wledAdapter.connectWithContext(host, identifier, context);
							attemptedRegistrationCreated = true;
							connectionState = ConnectionState.CONNECTED;
						} catch (error) {
							this.logger.warn(
								`WLED device ${identifier} was adopted but its live connection could not be registered`,
								{
									resource: device.id,
									message: error instanceof Error ? error.message : String(error),
								},
							);
						}
					}
				}
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: connectionState,
				});
				results[index] = {
					host,
					name: request.name,
					status: existingDevice ? 'updated' : 'created',
					error: null,
					deviceId: device.id,
				};
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);

				if (dependencyGroup) {
					const dependentFailure = `A related WLED address move failed: ${reason}`;
					failedDependencyGroups.set(dependencyGroup, dependentFailure);
					const dependentPlans = plans.filter((plan) => dependencyGroup.has(plan.index));
					const involvedHosts = new Set(
						dependentPlans.flatMap((plan) =>
							[plan.host, plan.existingDevice?.hostname].filter((item): item is string => !!item),
						),
					);

					for (const involvedHost of involvedHosts) {
						await this.tryRollback(`disconnect ${involvedHost}`, () =>
							Promise.resolve(this.wledAdapter.disconnect(involvedHost, false)),
						);
					}

					for (const dependentPlan of dependentPlans) {
						if (dependentPlan.existingDevice) {
							const original = dependentPlan.existingDevice;
							const structureSnapshot = structureSnapshotsByPlan.get(dependentPlan.index);
							if (structureSnapshot) {
								await this.tryRollback(`restore device structure ${original.id}`, () =>
									this.adoptionSnapshot.restore(structureSnapshot),
								);
							}
							await this.tryRollback(`restore device ${original.id}`, () =>
								this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(original.id, {
									type: DEVICES_WLED_TYPE,
									identifier: original.identifier,
									name: original.name,
									description: original.description,
									enabled: original.enabled,
									hostname: original.hostname,
								}),
							);
							await this.tryRollback(`reconnect device ${original.id}`, () => this.restoreDeviceConnection(original));
						} else {
							const partialDevice = await this.tryRollback(
								`find partial device ${dependentPlan.identifier}`,
								() =>
									this.devicesService.findOneBy<WledDeviceEntity>(
										'identifier',
										dependentPlan.identifier,
										DEVICES_WLED_TYPE,
									),
								null,
							);
							const createdDeviceId = createdDeviceIdsByPlan.get(dependentPlan.index) ?? partialDevice?.id;
							if (createdDeviceId) {
								await this.tryRollback(`remove partial device ${createdDeviceId}`, () =>
									this.devicesService.remove(createdDeviceId),
								);
								createdDeviceIdsByPlan.delete(dependentPlan.index);
							}
						}

						results[dependentPlan.index] = {
							host: dependentPlan.host,
							name: dependentPlan.request.name,
							status: 'failed',
							error: dependentFailure,
							deviceId: dependentPlan.existingDevice?.id ?? null,
						};
					}

					for (const staleHostOwner of retiredStaleOwnersByDependencyGroup.get(dependencyGroup)?.values() ?? []) {
						await this.tryRollback(`restore stale owner ${staleHostOwner.id}`, () =>
							this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(staleHostOwner.id, {
								type: DEVICES_WLED_TYPE,
								identifier: staleHostOwner.identifier,
								name: staleHostOwner.name,
								description: staleHostOwner.description,
								enabled: staleHostOwner.enabled,
								hostname: staleHostOwner.hostname,
							}),
						);
						retiredDeviceIds.delete(staleHostOwner.id);
						if (disconnectedStaleOwnerIdsByDependencyGroup.get(dependencyGroup)?.has(staleHostOwner.id)) {
							await this.tryRollback(`reconnect stale owner ${staleHostOwner.id}`, () =>
								this.restoreDeviceConnection(staleHostOwner),
							);
						}
					}
				} else {
					if (attemptedRegistrationCreated) {
						await this.tryRollback(`disconnect ${host}`, () =>
							Promise.resolve(this.wledAdapter.disconnect(host, false)),
						);
					}
					const partialDevice =
						mappedDevice ??
						(await this.tryRollback(
							`find partial device ${identifier}`,
							() => this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE),
							null,
						));

					if (existingDevice) {
						const structureSnapshot = structureSnapshotsByPlan.get(index);
						if (structureSnapshot) {
							await this.tryRollback(`restore device structure ${existingDevice.id}`, () =>
								this.adoptionSnapshot.restore(structureSnapshot),
							);
						}
						await this.tryRollback(`restore device ${existingDevice.id}`, () =>
							this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(existingDevice.id, {
								type: DEVICES_WLED_TYPE,
								identifier: existingDevice.identifier,
								name: existingDevice.name,
								description: existingDevice.description,
								enabled: existingDevice.enabled,
								hostname: existingDevice.hostname,
							}),
						);
						if (existingDeviceDisconnected || attemptedRegistrationCreated) {
							await this.tryRollback(`reconnect device ${existingDevice.id}`, () =>
								this.restoreDeviceConnection(existingDevice),
							);
						}
					} else if (partialDevice) {
						await this.tryRollback(`remove partial device ${partialDevice.id}`, () =>
							this.devicesService.remove(partialDevice.id),
						);
					}

					for (const staleHostOwner of retiredStaleOwners) {
						await this.tryRollback(`restore stale owner ${staleHostOwner.id}`, () =>
							this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(staleHostOwner.id, {
								type: DEVICES_WLED_TYPE,
								identifier: staleHostOwner.identifier,
								name: staleHostOwner.name,
								description: staleHostOwner.description,
								enabled: staleHostOwner.enabled,
								hostname: staleHostOwner.hostname,
							}),
						);
						if (disconnectedStaleOwners.some(({ id }) => id === staleHostOwner.id)) {
							await this.tryRollback(`reconnect stale owner ${staleHostOwner.id}`, () =>
								this.restoreDeviceConnection(staleHostOwner),
							);
						}
					}

					results[index] = {
						host,
						name: request.name,
						status: 'failed',
						error: reason,
						deviceId: null,
					};
				}
			}
		}

		return results.filter((result): result is WledAdoptionResultModel => result !== undefined);
	}

	private enqueueProvisioning<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.adoptionQueue.then(operation);
		this.adoptionQueue = result.then<void>(
			() => undefined,
			() => undefined,
		);

		return result;
	}

	private async tryRollback<T>(description: string, operation: () => Promise<T>, fallback?: T): Promise<T | undefined> {
		try {
			return await operation();
		} catch (error) {
			this.logger.error(`WLED adoption rollback could not ${description}`, {
				message: error instanceof Error ? error.message : String(error),
			});
			return fallback;
		}
	}

	private async restoreDeviceConnection(device: WledDeviceEntity): Promise<void> {
		let state = ConnectionState.DISCONNECTED;

		if (device.enabled && device.hostname && device.identifier) {
			try {
				await this.wledAdapter.connect(device.hostname, device.identifier, this.config.timeouts.connectionTimeout);
				state = ConnectionState.CONNECTED;
			} catch (error) {
				this.logger.warn(`Could not restore the WLED connection for ${device.identifier}`, {
					resource: device.id,
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		await this.deviceConnectivityService.setConnectionState(device.id, { state });
	}

	/**
	 * Get discovered devices that haven't been added to the database yet
	 */
	async getUnadedDiscoveredDevices(): Promise<WledMdnsDiscoveredDevice[]> {
		const discoveredDevices = this.mdnsDiscoverer.getDiscoveredDevices();
		const databaseDevices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);

		// Get hostnames of devices already in database
		const existingHostnames = new Set(databaseDevices.map((d) => d.hostname));

		// Filter out devices that are already in the database
		return discoveredDevices.filter(
			(device) =>
				![...existingHostnames].some(
					(hostname) =>
						hostname !== null && this.endpointsEquivalent(hostname, this.discoveryEndpoint(device.host, device.port)),
				),
		);
	}

	private discoveryEndpoint(host: string, port: number): string {
		const normalizedHost = this.normalizeHost(host);
		const hasExplicitPort = /^\[[^\]]+\]:\d+$/.test(normalizedHost) || /^[^:]+:\d+$/.test(normalizedHost);

		return port === 80 || hasExplicitPort ? normalizedHost : `${normalizedHost}:${port}`;
	}

	private normalizeHost(host: string): string {
		const trimmed = host.trim();
		if (!trimmed) {
			throw new WledValidationException('WLED hostname or IP address is required');
		}

		if (/^https?:\/\//i.test(trimmed)) {
			let url: URL;
			try {
				url = new URL(trimmed);
			} catch {
				throw new WledValidationException('WLED address must be a valid hostname or IP address');
			}
			if (url.pathname !== '/' || url.search || url.hash) {
				throw new WledValidationException('WLED address must not include a path, query, or fragment');
			}
			return url.host;
		}

		if (trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#')) {
			throw new WledValidationException('WLED address must be a hostname or IP address');
		}

		if (!trimmed.startsWith('[') && (trimmed.match(/:/g)?.length ?? 0) > 1) {
			return `[${trimmed}]`;
		}

		return trimmed;
	}

	private identifierFromMac(mac: string): string {
		const normalizedMac = this.normalizeMac(mac);
		if (!normalizedMac) {
			throw new WledValidationException('WLED device did not report a valid MAC address');
		}

		return `wled-${normalizedMac}`;
	}

	private findExistingDevice(
		devices: WledDeviceEntity[],
		host: string,
		mac?: string | null,
	): WledDeviceEntity | undefined {
		if (mac) {
			const normalizedMac = this.normalizeMac(mac);
			if (normalizedMac) {
				const canonicalIdentifier = `wled-${normalizedMac}`;
				const legacyIdentifier = `wled-${normalizedMac.slice(-6)}`;
				const legacyHostIdentifiers = this.legacyHostIdentifiers(host);
				const legacyDevices = devices.filter((device) => device.identifier === legacyIdentifier);

				return (
					devices.find((device) => device.identifier === canonicalIdentifier) ??
					legacyDevices.find((device) => this.deviceSerialMac(device) === normalizedMac) ??
					legacyDevices.find((device) => device.hostname !== null && this.endpointsEquivalent(device.hostname, host)) ??
					devices.find(
						(device) =>
							device.identifier !== null &&
							legacyHostIdentifiers.has(device.identifier.toLowerCase()) &&
							device.hostname !== null &&
							this.endpointsEquivalent(device.hostname, host),
					) ??
					devices.find(
						(device) =>
							device.identifier === null && device.hostname !== null && this.endpointsEquivalent(device.hostname, host),
					)
				);
			}
		}

		return devices.find((device) => device.hostname !== null && this.endpointsEquivalent(device.hostname, host));
	}

	private normalizeMac(mac?: string | null): string | null {
		if (!mac) {
			return null;
		}

		const normalized = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
		return normalized.length === 12 ? normalized : null;
	}

	private deviceSerialMac(device: WledDeviceEntity): string | null {
		const serial = device.channels
			?.find((channel) => channel.identifier === WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION)
			?.properties?.find((property) => property.identifier === WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER)
			?.value?.value;

		if (typeof serial !== 'string') {
			return null;
		}

		return this.normalizeMac(serial);
	}

	private requiresCanonicalIdentity(device: WledDeviceEntity, host: string, mac?: string | null): boolean {
		if (!mac) {
			return false;
		}

		const canonicalIdentifier = this.identifierFromMac(mac);
		const identifier = device.identifier?.toLowerCase() ?? null;

		return (
			identifier === null ||
			identifier === `wled-${canonicalIdentifier.slice(-6)}` ||
			this.legacyHostIdentifiers(device.hostname ?? host).has(identifier)
		);
	}

	private endpointsEquivalent(first: string, second: string): boolean {
		return this.canonicalEndpoint(first) === this.canonicalEndpoint(second);
	}

	private canonicalEndpoint(endpoint: string): string {
		const trimmed = endpoint.trim().toLowerCase();
		const urlHost = !trimmed.startsWith('[') && (trimmed.match(/:/g)?.length ?? 0) > 1 ? `[${trimmed}]` : trimmed;

		try {
			const url = new URL(`http://${urlHost}`);
			return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
		} catch {
			// Fall through for unusual host spellings (for example scoped IPv6 literals)
			// that URL cannot parse but the WLED client may still support.
		}

		const bracketedIpv6 = trimmed.match(/^\[([^\]]+)](?::(\d+))?$/);
		if (bracketedIpv6) {
			const [, address, port] = bracketedIpv6;
			return port && port !== '80' ? `[${address}]:${port}` : `[${address}]`;
		}

		if ((trimmed.match(/:/g)?.length ?? 0) > 1) {
			return `[${trimmed}]`;
		}

		return trimmed.replace(/:80$/, '');
	}

	private legacyHostIdentifiers(endpoint: string): Set<string> {
		const bracketedHost = endpoint.match(/^\[([^\]]+)](?::\d+)?$/)?.[1];
		const rawHost = bracketedHost ?? endpoint.replace(/:\d+$/, '');

		return new Set([endpoint, rawHost].map((host) => `wled-${host.replace(/\./g, '-')}`.toLowerCase()));
	}

	private portFromHost(host: string): number {
		const port = Number(host.match(/:(\d+)$/)?.[1] ?? 80);
		return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 80;
	}

	/**
	 * Get plugin configuration
	 */
	private get config(): WledConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<WledConfigModel>(DEVICES_WLED_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Wait until service reaches one of the specified states
	 */
	private async waitUntil(...states: ServiceState[]): Promise<void> {
		const maxWait = 10000;
		const interval = 100;
		let elapsed = 0;

		while (!states.includes(this.state) && elapsed < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, interval));
			elapsed += interval;
		}

		if (!states.includes(this.state)) {
			throw new Error(`Timeout waiting for state ${states.join(' or ')}, current state: ${this.state}`);
		}
	}
}
