import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import {
	ConfigChangeResult,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_TYPE } from '../devices-wled.constants';
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

		// Check if we already have this device configured by hostname
		const devices = await this.devicesService.findAll<WledDeviceEntity>(DEVICES_WLED_TYPE);
		const existingDevice = devices.find((d) => d.hostname === device.host);

		if (existingDevice) {
			this.logger.debug(`Device at ${device.host} already exists in database`);

			// If device is enabled and not connected, try to connect
			if (existingDevice.enabled && !this.wledAdapter.isConnected(device.host)) {
				this.logger.debug(`Connecting to existing device at ${device.host}`);
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
				const identifier = device.mac ? this.identifierFromMac(device.mac) : `wled-${device.host.replace(/\./g, '-')}`;
				await this.wledAdapter.connect(device.host, identifier, this.config.timeouts.connectionTimeout);

				const registeredDevice = this.wledAdapter.getDevice(device.host);

				if (registeredDevice?.context) {
					await this.deviceMapper.mapDevice(device.host, registeredDevice.context, device.name, identifier);
				}
			} catch (error) {
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
		if (this.config.mdns.enabled) {
			this.mdnsDiscoverer.stop();
			this.mdnsDiscoverer.clearDiscoveredDevices();
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
				const identifier = existingDevice?.identifier || this.identifierFromMac(context.info.mac);
				const canonicalIdentity = this.identifierFromMac(context.info.mac);

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
				results[index] = {
					host,
					name: request.name,
					status: 'failed',
					error: error instanceof Error ? error.message : String(error),
					deviceId: null,
				};
			}
		}

		const selectedDeviceIds = new Set(
			plans.flatMap(({ existingDevice }) => (existingDevice ? [existingDevice.id] : [])),
		);
		const dependencyEdges = new Map<number, Set<number>>();
		for (const plan of plans) {
			const selectedTargetOwner = plans.find(
				(candidate) =>
					candidate.existingDevice?.hostname === plan.host && candidate.existingDevice.id !== plan.existingDevice?.id,
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
		const retiredStaleOwnersByDependencyGroup = new Map<Set<number>, Map<string, WledDeviceEntity>>();

		for (const { index, request, host, context, existingDevice, identifier } of plans) {
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
			const disconnectedStaleOwners: WledDeviceEntity[] = [];

			try {
				if (existingDevice && !existingDevice.identifier) {
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
					(device) => device.hostname === host && device.id !== existingDevice?.id,
				);
				const retiringHostOwners = staleHostOwners.filter(
					(staleHostOwner) => !selectedDeviceIds.has(staleHostOwner.id) && !retiredDeviceIds.has(staleHostOwner.id),
				);
				if (dependencyGroup && retiringHostOwners.length > 0) {
					const groupOwners =
						retiredStaleOwnersByDependencyGroup.get(dependencyGroup) ?? new Map<string, WledDeviceEntity>();
					for (const staleHostOwner of retiringHostOwners) {
						groupOwners.set(staleHostOwner.id, staleHostOwner);
					}
					retiredStaleOwnersByDependencyGroup.set(dependencyGroup, groupOwners);
				}
				if (staleHostOwners.length > 0) {
					this.wledAdapter.disconnect(host, false);
					disconnectedStaleOwners.push(...retiringHostOwners);
				}
				for (const staleHostOwner of retiringHostOwners) {
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
						this.wledAdapter.disconnect(involvedHost, false);
					}

					for (const dependentPlan of dependentPlans) {
						if (dependentPlan.existingDevice) {
							const original = dependentPlan.existingDevice;
							await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(original.id, {
								type: DEVICES_WLED_TYPE,
								identifier: original.identifier,
								name: original.name,
								description: original.description,
								enabled: original.enabled,
								hostname: original.hostname,
							});
							await this.restoreDeviceConnection(original);
						} else {
							const partialDevice = await this.devicesService.findOneBy<WledDeviceEntity>(
								'identifier',
								dependentPlan.identifier,
								DEVICES_WLED_TYPE,
							);
							const createdDeviceId = createdDeviceIdsByPlan.get(dependentPlan.index) ?? partialDevice?.id;
							if (createdDeviceId) {
								await this.devicesService.remove(createdDeviceId);
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
						await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(staleHostOwner.id, {
							type: DEVICES_WLED_TYPE,
							identifier: staleHostOwner.identifier,
							name: staleHostOwner.name,
							description: staleHostOwner.description,
							enabled: staleHostOwner.enabled,
							hostname: staleHostOwner.hostname,
						});
						retiredDeviceIds.delete(staleHostOwner.id);
						await this.restoreDeviceConnection(staleHostOwner);
					}
				} else {
					const attemptedRegistration = this.wledAdapter.getDevice(host);
					const attemptedHostDisconnected =
						attemptedRegistration?.host === host && attemptedRegistration.identifier === identifier;
					if (attemptedHostDisconnected) {
						this.wledAdapter.disconnect(host, false);
					}
					const partialDevice =
						mappedDevice ??
						(await this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE));

					if (existingDevice) {
						await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(existingDevice.id, {
							type: DEVICES_WLED_TYPE,
							identifier: existingDevice.identifier,
							name: existingDevice.name,
							description: existingDevice.description,
							enabled: existingDevice.enabled,
							hostname: existingDevice.hostname,
						});
						if (existingDeviceDisconnected || attemptedHostDisconnected) {
							await this.restoreDeviceConnection(existingDevice);
						}
					} else if (partialDevice) {
						await this.devicesService.remove(partialDevice.id);
					}

					for (const staleHostOwner of disconnectedStaleOwners) {
						await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(staleHostOwner.id, {
							type: DEVICES_WLED_TYPE,
							identifier: staleHostOwner.identifier,
							name: staleHostOwner.name,
							description: staleHostOwner.description,
							enabled: staleHostOwner.enabled,
							hostname: staleHostOwner.hostname,
						});
						await this.restoreDeviceConnection(staleHostOwner);
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
			(device) => !existingHostnames.has(this.discoveryEndpoint(device.host, device.port)),
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
		const normalizedMac = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
		if (normalizedMac.length !== 12) {
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
			const normalizedMac = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
			if (normalizedMac.length === 12) {
				const canonicalIdentifier = `wled-${normalizedMac}`;
				const legacyIdentifier = `wled-${normalizedMac.slice(-6)}`;
				const legacyHostIdentifier = `wled-${host.replace(/\./g, '-')}`;

				return (
					devices.find((device) => device.identifier === canonicalIdentifier) ??
					devices.find((device) => device.identifier === legacyIdentifier) ??
					devices.find((device) => device.identifier === legacyHostIdentifier && device.hostname === host) ??
					devices.find((device) => device.identifier === null && device.hostname === host)
				);
			}
		}

		return devices.find((device) => device.hostname === host);
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
