import { Inject, Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-plugin-service.interface';
import { HomeyConnectorFactory } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import { HomeyUnsubscribe } from '../connectors/homey-connector.types';
import {
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	DEVICES_HOMEY_TYPE,
	HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS,
	HOMEY_COMMAND_WRITE_TIMEOUT_MS,
	HOMEY_CONNECTOR_FACTORY,
	HomeyConnectionState,
} from '../devices-homey.constants';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyCapabilityValue } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';
import { HomeyStatusModel } from '../models/status.model';
import { homeyCapabilityValuesEqual } from '../platforms/homey-command-value';

import { HomeyFailureLogLimiter } from './homey-failure-log-limiter';
import { calculateHomeyReconnectDelay } from './homey-reconnect-backoff';
import {
	HomeyAcceptedCapabilityValue,
	HomeyOperationalDiagnostics,
	HomeySynchronizationResult,
	HomeySynchronizerService,
} from './homey-synchronizer.service';

const HOMEY_EVENT_OBSERVATION_REVISION = Symbol('homeyEventObservationRevision');

type ObservedHomeyEvent = HomeyEvent & {
	readonly [HOMEY_EVENT_OBSERVATION_REVISION]?: number;
};

type HomeyReconciliationSource = 'startup' | 'reconnect' | 'periodic';

interface PendingHomeyCommandConfirmation {
	readonly generation: number;
	readonly observationRevision: number;
	readonly value: HomeyCapabilityValue;
	readonly resolve: (confirmed: boolean) => void;
}

interface AcceptedHomeyCapabilityState {
	readonly revision: number;
	readonly value: HomeyCapabilityValue;
}

type HomeyBoundedResult<T> =
	| { readonly status: 'fulfilled'; readonly value: T }
	| { readonly status: 'rejected' | 'timed_out' | 'cancelled' };

@Injectable()
export class HomeyService extends BaseManagedPluginService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyService');
	private readonly failureLogLimiter = new HomeyFailureLogLimiter();

	readonly pluginName = DEVICES_HOMEY_PLUGIN_NAME;
	readonly serviceId = DEVICES_HOMEY_CONNECTOR_SERVICE_ID;

	private pluginConfig: HomeyConfigModel | null = null;
	private lastError: string | null = null;
	private connectionState = HomeyConnectionState.STOPPED;
	private healthy = false;
	private connector: HomeyConnector | null = null;
	private unsubscribe: HomeyUnsubscribe | null = null;
	private systemInfo: HomeySystemInfo | null = null;
	private lastSystemInfo: HomeySystemInfo | null = null;
	private zones: readonly HomeyZone[] = [];
	private devices = new Map<string, HomeyDevice>();
	private startupEvents: HomeyEvent[] | null = null;
	private generation = 0;
	private synchronizationTail: Promise<void> = Promise.resolve();
	private reconciliationTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private reconnectCount = 0;
	private liveEvents: HomeyEvent[] = [];
	private liveEventFlush: ReturnType<typeof setImmediate> | null = null;
	private lastConnectedAt: string | null = null;
	private lastInventorySyncAt: string | null = null;
	private lastEventAt: string | null = null;
	private lastErrorCategory: HomeyConnectorErrorCategory | null = null;
	private reconciliationCount = 0;
	private reconciliationFailureCount = 0;
	private lastReconciliationDurationMs: number | null = null;
	private operationalDiagnostics: HomeyOperationalDiagnostics = {
		adopted: 0,
		adoptedDevices: [],
		missing: 0,
		unsupported: 0,
		unavailable: 0,
	};
	private operationalInventoryDeviceIds = new Set<string>();
	private operationalDiagnosticsRevision = 0;
	private readonly commandTails = new Map<string, Promise<void>>();
	private readonly pendingCommandConfirmations = new Map<string, PendingHomeyCommandConfirmation>();
	private readonly commandCancellationListeners = new Set<() => void>();
	private readonly capabilityCommandRevisions = new Map<string, number>();
	private readonly capabilityObservationRevisions = new Map<string, number>();
	private readonly deviceInventoryRevisions = new Map<string, number>();
	private readonly acceptedCapabilityStates = new Map<string, AcceptedHomeyCapabilityState>();
	private capabilityObservationRevision = 0;
	private capabilityCommandRevision = 0;
	private deviceInventoryRevision = 0;
	private acceptedCapabilityRevision = 0;

	constructor(
		private readonly configService: ConfigService,
		private readonly synchronizer: HomeySynchronizerService,
		@Optional()
		@Inject(HOMEY_CONNECTOR_FACTORY)
		private readonly connectorFactory: HomeyConnectorFactory | null = null,
	) {
		super();
	}

	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') {
				return;
			}

			await this.cleanupPreviousGeneration();

			this.state = 'starting';
			this.pluginConfig = null;
			this.resetReconnectState();
			this.resetRuntimeHealth();
			this.lastError = null;
			this.healthy = false;
			this.transitionConnectionState(HomeyConnectionState.CONNECTING, 'service_start');
			const generation = ++this.generation;

			try {
				const config = this.getPluginConfig();
				const connector = this.createConnector(config);
				this.connector = connector;

				await connector.connect();
				this.recordSuccessfulConnection();
				const subscriptionFailure = await this.synchronizeStartup(connector, generation, 'startup');

				this.state = 'started';

				if (subscriptionFailure) {
					this.markRuntimeDegraded(subscriptionFailure, generation);
					this.logger.warn('Homey inventory synchronized with event delivery unavailable');
				} else {
					this.markRuntimeHealthy(connector, generation);
					this.logger.log('Homey connector started and initial inventory synchronized');
				}
			} catch (error) {
				this.applyFailureState(error, 'Homey service failed to start');
				const retryable = this.isRetryableFailure(error);
				const retryGeneration = ++this.generation;
				await this.cleanupRuntime();

				if (retryable) {
					this.state = 'started';
					this.scheduleReconnect(retryGeneration);
					this.logger.warn('Homey service startup is unavailable; reconnect scheduled');
					return;
				}

				this.state = 'error';
				this.healthy = false;
				this.logger.error(this.lastError ?? 'Homey service failed to start');

				// Raw connector/config errors can contain the write-only key or endpoint.
				// eslint-disable-next-line preserve-caught-error
				throw new Error(this.lastError ?? 'Homey service failed to start');
			}
		});
	}

	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped' && !this.hasRuntimeResources()) {
				return;
			}

			this.state = 'stopping';
			this.generation += 1;
			this.healthy = false;
			this.transitionConnectionState(HomeyConnectionState.STOPPED, 'service_stop');

			const cleaned = await this.cleanupRuntime();

			this.pluginConfig = null;
			this.resetReconnectState();

			if (!cleaned) {
				this.state = 'error';
				this.lastError = 'Homey service failed to stop';
				this.lastErrorCategory = null;
				this.logger.error(this.lastError);

				throw new Error(this.lastError);
			}

			this.state = 'stopped';
			this.lastError = null;
			this.lastErrorCategory = null;
			this.logger.log('Homey connector stopped');
		});
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state === 'started' && this.pluginConfig) {
			const previous = this.pluginConfig;
			const next = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
			const restartRequired =
				previous.url !== next.url ||
				previous.apiKey !== next.apiKey ||
				previous.connectionTimeout !== next.connectionTimeout ||
				previous.reconciliationInterval !== next.reconciliationInterval;

			return Promise.resolve({ restartRequired });
		}

		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.healthy && this.state === 'started');
	}

	getStatus(): HomeyStatusModel {
		const config = this.getCurrentPluginConfigOrDefault();
		const status = new HomeyStatusModel();

		status.serviceState = this.getState();
		status.connectionState = this.connectionState;
		status.enabled = config.enabled;
		status.configured = this.isConfigured(config);
		status.healthy = this.healthy;
		status.degraded = this.connectionState === HomeyConnectionState.DEGRADED_POLLING;
		status.homeyId = this.lastSystemInfo?.id ?? null;
		status.homeyName = this.lastSystemInfo?.name ?? null;
		status.homeyVersion = this.lastSystemInfo?.version ?? null;
		status.lastConnectedAt = this.lastConnectedAt;
		status.lastInventorySyncAt = this.lastInventorySyncAt;
		status.lastEventAt = this.lastEventAt;
		status.lastEventAgeMs = this.calculateLastEventAgeMs();
		status.adoptedDeviceCount = this.operationalDiagnostics.adopted;
		status.missingDeviceCount = this.operationalDiagnostics.missing;
		status.unsupportedDeviceCount = this.operationalDiagnostics.unsupported;
		status.unavailableDeviceCount = this.operationalDiagnostics.unavailable;
		status.reconnectCount = this.reconnectCount;
		status.reconciliationCount = this.reconciliationCount;
		status.reconciliationFailureCount = this.reconciliationFailureCount;
		status.lastReconciliationDurationMs = this.lastReconciliationDurationMs;
		status.lastErrorCategory = this.lastErrorCategory;
		status.lastError = this.lastError;

		return status;
	}

	getInventorySnapshot(): readonly HomeyDevice[] | null {
		if (
			this.state !== 'started' ||
			this.lastInventorySyncAt === null ||
			(this.connectionState !== HomeyConnectionState.CONNECTED &&
				this.connectionState !== HomeyConnectionState.DEGRADED_POLLING)
		) {
			return null;
		}

		return structuredClone([...this.devices.values()]);
	}

	@OnEvent(EventType.DEVICE_CREATED)
	@OnEvent(EventType.DEVICE_UPDATED)
	onAdoptedDeviceUpserted(device: DeviceEntity): void {
		if (device.type !== DEVICES_HOMEY_TYPE) {
			return;
		}

		this.synchronizer.invalidateIndex();
		const adoptedDevices = new Map(
			this.operationalDiagnostics.adoptedDevices.map((adopted) => [adopted.panelDeviceId, adopted.homeyDeviceId]),
		);

		if (device.enabled && typeof device.identifier === 'string') {
			adoptedDevices.set(device.id, device.identifier);
		} else {
			adoptedDevices.delete(device.id);
		}

		this.recordLocalAdoptedDiagnostics(adoptedDevices);
	}

	@OnEvent(EventType.DEVICE_DELETED)
	onAdoptedDeviceDeleted(device: DeviceEntity): void {
		if (device.type !== DEVICES_HOMEY_TYPE) {
			return;
		}

		this.synchronizer.invalidateIndex();
		const adoptedDevices = new Map(
			this.operationalDiagnostics.adoptedDevices.map((adopted) => [adopted.panelDeviceId, adopted.homeyDeviceId]),
		);
		adoptedDevices.delete(device.id);
		this.recordLocalAdoptedDiagnostics(adoptedDevices);
	}

	async executeCapabilityCommand(
		deviceId: string,
		capabilityId: string,
		value: HomeyCapabilityValue,
	): Promise<boolean> {
		const key = this.commandKey(deviceId, capabilityId);
		const generation = this.generation;

		const successful = await this.enqueueCapabilityCommand(key, (retainWrite) =>
			this.executeSerializedCapabilityCommand(key, deviceId, capabilityId, value, generation, retainWrite),
		);

		if (!successful) {
			this.logRateLimitedFailure('command', 'warn', 'Homey capability command failed or could not be confirmed', {
				outcome: 'rejected_or_unconfirmed',
			});
		}

		return successful;
	}

	async getFreshDevice(deviceId: string): Promise<HomeyDevice | null> {
		const connector = this.connector;

		if (
			this.state !== 'started' ||
			connector === null ||
			(this.connectionState !== HomeyConnectionState.CONNECTED &&
				this.connectionState !== HomeyConnectionState.DEGRADED_POLLING)
		) {
			throw new HomeyInventoryUnavailableError();
		}

		const device = await connector.getDevice(deviceId);

		return device === null ? null : structuredClone(device);
	}

	private getPluginConfig(): HomeyConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	private createConnector(config: HomeyConfigModel): HomeyConnector {
		if (!this.isConfigured(config)) {
			throw new HomeyConnectorError(HomeyConnectorErrorCategory.VALIDATION, HomeyConnectorOperation.CONNECT);
		}

		if (!this.connectorFactory) {
			throw new HomeyConnectorError(HomeyConnectorErrorCategory.UNSUPPORTED, HomeyConnectorOperation.CONNECT);
		}

		return this.connectorFactory.create({
			url: config.url,
			apiKey: config.apiKey,
			connectionTimeout: config.connectionTimeout,
		});
	}

	private async synchronizeStartup(
		connector: HomeyConnector,
		generation: number,
		source: Extract<HomeyReconciliationSource, 'startup' | 'reconnect'>,
	): Promise<HomeyConnectorError | null> {
		let subscriptionFailure: HomeyConnectorError | null = null;

		await this.runInventoryReconciliation(source, async () => {
			this.systemInfo = await connector.getSystemInfo();
			this.lastSystemInfo = this.systemInfo;
			this.zones = await connector.getZones();
			this.startupEvents = [];

			try {
				this.unsubscribe = await connector.subscribe((event) => this.onConnectorEvent(connector, generation, event));
			} catch (error) {
				this.startupEvents = null;

				if (!this.isDegradableSubscriptionFailure(error)) {
					throw error;
				}

				subscriptionFailure = error;
			}

			await this.enqueueSynchronization(async () => {
				this.replaceDevices(await connector.getDevices());
				const result = await this.synchronizer.synchronizeSnapshot([...this.devices.values()]);
				this.recordSynchronizationResult(result);
				this.recordCapabilityEvidence(result.acceptedCapabilityValues ?? []);
				await this.refreshOperationalDiagnostics([...this.devices.values()]);

				if (this.startupEvents) {
					await this.reconcileStartupEvents(connector, generation);
				}

				this.recordSuccessfulInventorySync(connector, generation);
			});
		});

		return subscriptionFailure;
	}

	private async reconcileStartupEvents(connector: HomeyConnector, generation: number): Promise<void> {
		let cursor = 0;
		let pass = 0;

		while (this.startupEvents && cursor < this.startupEvents.length && pass < 10) {
			const events = this.startupEvents.slice(cursor);
			cursor += events.length;
			pass += 1;
			await this.reconcileEvents(connector, generation, events, true);
		}

		const remainingEvents = this.startupEvents?.slice(cursor) ?? [];
		this.startupEvents = null;

		if (remainingEvents.length > 0) {
			await this.reconcileEvents(connector, generation, remainingEvents, true);
		}
	}

	private onConnectorEvent(connector: HomeyConnector, generation: number, event: HomeyEvent): void {
		if (!this.isCurrentGeneration(connector, generation)) {
			return;
		}

		let observedEvent: ObservedHomeyEvent = event;

		if (event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED) {
			const observationRevision = ++this.capabilityObservationRevision;
			this.capabilityObservationRevisions.set(this.commandKey(event.deviceId, event.capabilityId), observationRevision);
			observedEvent = { ...event, [HOMEY_EVENT_OBSERVATION_REVISION]: observationRevision };
		}

		if (this.startupEvents) {
			this.startupEvents.push(observedEvent);

			return;
		}

		this.liveEvents.push(observedEvent);

		if (this.liveEventFlush !== null) {
			return;
		}

		this.liveEventFlush = setImmediate(() => {
			this.liveEventFlush = null;
			const events = this.liveEvents;
			this.liveEvents = [];
			void this.flushLiveEvents(connector, generation, events);
		});
	}

	private flushLiveEvents(connector: HomeyConnector, generation: number, events: readonly HomeyEvent[]): Promise<void> {
		return this.enqueueSynchronization(async () => {
			try {
				const authoritativeTraffic = await this.reconcileEvents(connector, generation, events);

				if (authoritativeTraffic) {
					this.markRuntimeHealthy(connector, generation);
				}
			} catch (error) {
				if (this.isCurrentGeneration(connector, generation)) {
					this.handleRuntimeFailure(error, 'Homey event synchronization failed', generation);
					this.logRateLimitedFailure(
						'event-synchronization',
						'error',
						this.lastError ?? 'Homey event synchronization failed',
						{ category: this.lastErrorCategory },
					);
				}
			}
		});
	}

	private async reconcileEvents(
		connector: HomeyConnector,
		generation: number,
		events: readonly HomeyEvent[],
		authoritativeReadback = false,
	): Promise<boolean> {
		if (!this.isCurrentGeneration(connector, generation)) {
			return false;
		}

		const containsZoneEvent = events.some((event) => this.isZoneEvent(event));

		let inventoryReplaced = false;
		let authoritativeTraffic = false;

		if (containsZoneEvent) {
			const zones = await connector.getZones();
			const devices = await connector.getDevices();

			if (!this.isCurrentGeneration(connector, generation)) {
				return false;
			}

			this.zones = zones;
			this.replaceDevices(devices);
			inventoryReplaced = true;
			authoritativeTraffic = true;
		}

		const deviceIds = [...new Set(events.flatMap((event) => ('deviceId' in event ? [event.deviceId] : [])))];
		const refreshedDevices: HomeyDevice[] = [];
		const missingDeviceIds: string[] = [];
		const selectedEvents = inventoryReplaced || authoritativeReadback ? events : this.synchronizer.filterEvents(events);
		const targetedDeviceIds = new Set(
			authoritativeReadback
				? deviceIds
				: selectedEvents.flatMap((event) =>
						event.type === HomeyEventType.DEVICE_ADDED || event.type === HomeyEventType.DEVICE_UPDATED
							? [event.deviceId]
							: [],
					),
		);

		if (!inventoryReplaced) {
			for (const deviceId of targetedDeviceIds) {
				const device = await connector.getDevice(deviceId);

				if (!this.isCurrentGeneration(connector, generation)) {
					return false;
				}

				authoritativeTraffic = true;

				if (device) {
					this.setDevice(device);
					refreshedDevices.push(device);
				} else {
					this.deleteDevice(deviceId);
					missingDeviceIds.push(deviceId);
				}
			}

			for (const event of selectedEvents) {
				if ('deviceId' in event && targetedDeviceIds.has(event.deviceId)) {
					continue;
				}

				authoritativeTraffic =
					(await this.updateInventoryFromEvent(connector, generation, event)) || authoritativeTraffic;
			}
		}

		if (events.length > 0 && this.isCurrentGeneration(connector, generation)) {
			this.logger.debug('Processing normalized Homey event batch', { eventCount: events.length });
			const confirmationEvents: HomeyEvent[] = [];

			if (inventoryReplaced) {
				const result = await this.synchronizer.synchronizeSnapshot([...this.devices.values()], events);
				this.recordSynchronizationResult(result);
				this.recordCapabilityEvidence(result.acceptedCapabilityValues ?? []);
				confirmationEvents.push(...result.acceptedEvents);
			} else if (targetedDeviceIds.size > 0) {
				const readbackEvents = selectedEvents.filter(
					(event) => 'deviceId' in event && targetedDeviceIds.has(event.deviceId),
				);
				const result = await this.synchronizer.synchronizeDevices(refreshedDevices, missingDeviceIds, readbackEvents);
				this.recordSynchronizationResult(result);
				this.recordCapabilityEvidence(result.acceptedCapabilityValues ?? []);
				confirmationEvents.push(...result.acceptedEvents);

				const remainingEvents = selectedEvents.filter(
					(event) => !('deviceId' in event) || !targetedDeviceIds.has(event.deviceId),
				);

				if (remainingEvents.length > 0) {
					const result = await this.synchronizer.synchronizeEvents(remainingEvents, this.devices);
					this.recordSynchronizationResult(result);
					confirmationEvents.push(...result.acceptedEvents);
				}
			} else if (selectedEvents.length > 0) {
				const result = await this.synchronizer.synchronizeEvents(selectedEvents, this.devices);
				this.recordSynchronizationResult(result);
				confirmationEvents.push(...result.acceptedEvents);
			}
			this.lastEventAt = this.now();
			this.recordAcceptedCapabilityEvents(confirmationEvents, generation);

			if (events.some((event) => event.type !== HomeyEventType.CAPABILITY_VALUE_CHANGED)) {
				await this.refreshOperationalDiagnostics([...this.devices.values()]);
			}
		}

		return authoritativeTraffic;
	}

	private async updateInventoryFromEvent(
		connector: HomeyConnector,
		generation: number,
		event: HomeyEvent,
	): Promise<boolean> {
		switch (event.type) {
			case HomeyEventType.DEVICE_ADDED:
			case HomeyEventType.DEVICE_UPDATED: {
				const device = await connector.getDevice(event.deviceId);

				if (!this.isCurrentGeneration(connector, generation)) {
					return false;
				}

				if (device === null) {
					this.deleteDevice(event.deviceId);
				} else {
					this.setDevice(device);
				}
				return true;
			}
			case HomeyEventType.DEVICE_REMOVED:
				this.deleteDevice(event.deviceId);
				return false;
			case HomeyEventType.DEVICE_AVAILABILITY_CHANGED: {
				const device = this.devices.get(event.deviceId);

				if (device !== undefined) {
					this.setDevice({
						...device,
						available: event.available,
						availabilityMessage: event.availabilityMessage,
					});
				}
				return false;
			}
			case HomeyEventType.CAPABILITY_VALUE_CHANGED: {
				return false;
			}
			case HomeyEventType.ZONE_ADDED:
			case HomeyEventType.ZONE_UPDATED:
			case HomeyEventType.ZONE_REMOVED:
				return false;
		}
	}

	private isZoneEvent(event: HomeyEvent): boolean {
		return (
			event.type === HomeyEventType.ZONE_ADDED ||
			event.type === HomeyEventType.ZONE_UPDATED ||
			event.type === HomeyEventType.ZONE_REMOVED
		);
	}

	private replaceDevices(devices: readonly HomeyDevice[]): void {
		for (const deviceId of new Set([...this.devices.keys(), ...devices.map((device) => device.id)])) {
			this.deviceInventoryRevisions.set(deviceId, ++this.deviceInventoryRevision);
		}
		this.devices = new Map(devices.map((device) => [device.id, device]));
	}

	private setDevice(device: HomeyDevice): void {
		this.devices.set(device.id, device);
		this.deviceInventoryRevisions.set(device.id, ++this.deviceInventoryRevision);
	}

	private deleteDevice(deviceId: string): void {
		if (this.devices.delete(deviceId)) {
			this.deviceInventoryRevisions.set(deviceId, ++this.deviceInventoryRevision);
		}
	}

	private scheduleReconciliation(generation: number): void {
		this.clearReconciliationTimer();

		const interval = this.pluginConfig?.reconciliationInterval;

		if (!interval || (this.reconnectTimer !== null && this.connectionState !== HomeyConnectionState.DEGRADED_POLLING)) {
			return;
		}

		this.reconciliationTimer = setTimeout(() => {
			this.reconciliationTimer = null;
			void this.runPeriodicReconciliation(generation);
		}, interval);
	}

	private async runPeriodicReconciliation(generation: number): Promise<void> {
		const connector = this.connector;

		if (!connector || !this.isCurrentGeneration(connector, generation) || this.state !== 'started') {
			return;
		}

		await this.enqueueSynchronization(async () => {
			try {
				await this.runInventoryReconciliation('periodic', async () => {
					const [zonesResult, devicesResult] = await Promise.allSettled([connector.getZones(), connector.getDevices()]);

					if (zonesResult.status === 'rejected') {
						throw zonesResult.reason as unknown;
					}

					if (devicesResult.status === 'rejected') {
						throw devicesResult.reason as unknown;
					}

					if (!this.isCurrentGeneration(connector, generation)) {
						return;
					}

					this.zones = zonesResult.value;
					this.replaceDevices(devicesResult.value);
					const result = await this.synchronizer.synchronizeSnapshot(devicesResult.value);
					this.recordSynchronizationResult(result);
					this.recordCapabilityEvidence(result.acceptedCapabilityValues ?? []);
					await this.refreshOperationalDiagnostics(devicesResult.value);
					this.recordSuccessfulInventorySync(connector, generation);

					if (this.unsubscribe) {
						this.markRuntimeHealthy(connector, generation);
					} else {
						this.transitionConnectionState(HomeyConnectionState.DEGRADED_POLLING, 'subscription_unavailable');
						this.healthy = false;
					}
				});
			} catch (error) {
				if (this.isCurrentGeneration(connector, generation)) {
					this.handleRuntimeFailure(error, 'Homey inventory reconciliation failed', generation);
				}
			}
		});

		if (
			this.isCurrentGeneration(connector, generation) &&
			this.state === 'started' &&
			(this.reconnectTimer === null || this.connectionState === HomeyConnectionState.DEGRADED_POLLING)
		) {
			this.scheduleReconciliation(generation);
		}
	}

	private scheduleReconnect(generation: number, preserveDegradedPolling = false): void {
		if (this.reconnectTimer || this.state !== 'started' || this.generation !== generation) {
			return;
		}

		if (!preserveDegradedPolling) {
			this.clearReconciliationTimer();
			this.transitionConnectionState(HomeyConnectionState.RECONNECTING, 'reconnect_scheduled');
		}
		this.healthy = false;
		const delay = calculateHomeyReconnectDelay(this.reconnectAttempt);
		this.reconnectAttempt += 1;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.runReconnect(generation);
		}, delay);
	}

	private async runReconnect(expectedGeneration: number): Promise<void> {
		await this.withLock(async () => {
			if (this.state !== 'started' || this.generation !== expectedGeneration) {
				return;
			}

			this.transitionConnectionState(HomeyConnectionState.RECONNECTING, 'reconnect_started');
			this.healthy = false;
			this.reconnectCount += 1;
			const generation = ++this.generation;

			if (!(await this.cleanupRuntime())) {
				this.lastError = 'Homey connector cleanup failed before reconnect';
				this.lastErrorCategory = null;
				this.scheduleReconnect(generation);
				return;
			}

			try {
				const connector = this.createConnector(this.getPluginConfig());
				this.connector = connector;
				await connector.connect();
				this.recordSuccessfulConnection();
				const subscriptionFailure = await this.synchronizeStartup(connector, generation, 'reconnect');

				if (subscriptionFailure) {
					this.markRuntimeDegraded(subscriptionFailure, generation);
					this.logger.warn('Homey reconnected in degraded polling mode');
				} else {
					this.markRuntimeHealthy(connector, generation);
					this.logger.log('Homey connector reconnected and inventory synchronized');
				}
			} catch (error) {
				this.applyFailureState(error, 'Homey service failed to reconnect', HomeyConnectionState.RECONNECTING);
				const retryGeneration = ++this.generation;
				await this.cleanupRuntime();

				if (this.isRetryableFailure(error)) {
					this.scheduleReconnect(retryGeneration);
				}

				this.logRateLimitedFailure('reconnect', 'error', this.lastError ?? 'Homey service failed to reconnect', {
					category: this.lastErrorCategory,
				});
			}
		});
	}

	private enqueueSynchronization(operation: () => Promise<void>): Promise<void> {
		const result = this.synchronizationTail.then(async () => {
			await operation();
		});
		this.synchronizationTail = this.settleSynchronization(result);

		return result;
	}

	private enqueueCapabilityCommand(
		key: string,
		operation: (retainWrite: (write: Promise<void>) => void) => Promise<boolean>,
	): Promise<boolean> {
		const previous = this.commandTails.get(key) ?? Promise.resolve();
		let retainedWrite: Promise<void> = Promise.resolve();
		const result = this.waitForCommandTail(previous, HOMEY_COMMAND_WRITE_TIMEOUT_MS).then((ready) => {
			if (!ready) {
				return false;
			}

			return operation((write) => {
				retainedWrite = write.then(
					(): void => undefined,
					(): void => undefined,
				);
			});
		});
		const retainBarrier = (): Promise<void> =>
			result.then(
				() => retainedWrite,
				() => retainedWrite,
			);
		const tail: Promise<void> = previous.then(retainBarrier, retainBarrier);
		this.commandTails.set(key, tail);
		void tail.then(() => {
			if (this.commandTails.get(key) === tail) {
				this.commandTails.delete(key);
			}
		});

		return result;
	}

	private waitForCommandTail(tail: Promise<void>, timeoutMs: number): Promise<boolean> {
		return new Promise((resolve) => {
			let settled = false;
			const complete = (ready: boolean): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				this.commandCancellationListeners.delete(cancel);
				resolve(ready);
			};
			const cancel = (): void => complete(false);
			const timer = setTimeout(() => complete(false), timeoutMs);
			this.commandCancellationListeners.add(cancel);
			void tail.then(
				() => complete(true),
				() => complete(true),
			);
		});
	}

	private async executeSerializedCapabilityCommand(
		key: string,
		deviceId: string,
		capabilityId: string,
		value: HomeyCapabilityValue,
		expectedGeneration: number,
		retainWrite: (write: Promise<void>) => void,
	): Promise<boolean> {
		if (this.generation !== expectedGeneration) {
			return false;
		}

		const connector = this.connector;
		const generation = expectedGeneration;

		if (
			connector === null ||
			this.state !== 'started' ||
			(this.connectionState !== HomeyConnectionState.CONNECTED &&
				this.connectionState !== HomeyConnectionState.DEGRADED_POLLING)
		) {
			return false;
		}
		const commandRevision = ++this.capabilityCommandRevision;
		this.capabilityCommandRevisions.set(key, commandRevision);

		let resolveConfirmation = (_confirmed: boolean): void => undefined;
		const confirmation = new Promise<boolean>((resolve) => {
			resolveConfirmation = resolve;
		});
		const pending: PendingHomeyCommandConfirmation = {
			generation,
			observationRevision: this.capabilityObservationRevisions.get(key) ?? 0,
			value,
			resolve: resolveConfirmation,
		};
		this.pendingCommandConfirmations.set(key, pending);

		try {
			const writeOperation = connector.setCapabilityValue(deviceId, capabilityId, value);
			retainWrite(writeOperation);
			const write = await this.settleWithin(writeOperation, HOMEY_COMMAND_WRITE_TIMEOUT_MS);

			if (write.status !== 'fulfilled' || !this.isCurrentGeneration(connector, generation)) {
				return false;
			}

			const confirmed = await this.settleWithin(confirmation, HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

			if (confirmed.status === 'fulfilled') {
				return confirmed.value;
			}

			if (confirmed.status === 'cancelled' || !this.isCurrentGeneration(connector, generation)) {
				return false;
			}

			this.removePendingCommandConfirmation(key, pending);
			const observedRevision = this.capabilityObservationRevisions.get(key) ?? 0;
			const inventoryRevision = this.deviceInventoryRevisions.get(deviceId) ?? 0;
			const acceptedRevision = this.acceptedCapabilityStates.get(key)?.revision ?? 0;
			const readback = await this.settleWithin(connector.getDevice(deviceId), HOMEY_COMMAND_WRITE_TIMEOUT_MS);

			if (
				readback.status !== 'fulfilled' ||
				readback.value === null ||
				!readback.value.available ||
				!this.isCurrentGeneration(connector, generation)
			) {
				return false;
			}

			const capability = readback.value.capabilities.find((candidate) => candidate.id === capabilityId);

			if (capability === undefined || !homeyCapabilityValuesEqual(capability.value, value)) {
				return false;
			}
			const confirmedDevice = readback.value;
			const readbackEvent: HomeyEvent = {
				type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
				deviceId,
				capabilityId,
				value: capability.value,
				lastUpdatedAt: capability.lastUpdatedAt,
				occurredAt: null,
				sequence: null,
			};
			let readbackAccepted = false;

			const synchronization = this.enqueueSynchronization(async () => {
				if (
					!this.isCurrentGeneration(connector, generation) ||
					this.capabilityCommandRevisions.get(key) !== commandRevision
				) {
					return;
				}
				const currentDevice = this.devices.get(deviceId);

				if (currentDevice === undefined || !currentDevice.available) {
					return;
				}
				const hasReadableCapabilityBinding = await this.synchronizer.hasReadableCapabilityBinding(
					deviceId,
					capabilityId,
				);

				if (!hasReadableCapabilityBinding && (this.deviceInventoryRevisions.get(deviceId) ?? 0) !== inventoryRevision) {
					return;
				}

				const currentAcceptedState = this.acceptedCapabilityStates.get(key);
				const observationChanged = (this.capabilityObservationRevisions.get(key) ?? 0) !== observedRevision;
				const acceptanceChanged = (currentAcceptedState?.revision ?? 0) !== acceptedRevision;

				if (observationChanged || acceptanceChanged) {
					readbackAccepted =
						acceptanceChanged &&
						currentAcceptedState !== undefined &&
						homeyCapabilityValuesEqual(currentAcceptedState.value, value);
					return;
				}

				if (currentAcceptedState !== undefined && homeyCapabilityValuesEqual(currentAcceptedState.value, value)) {
					readbackAccepted = true;
					return;
				}

				if (!hasReadableCapabilityBinding) {
					readbackAccepted = true;
					this.recordAcceptedCapabilityEvents([readbackEvent], generation);
					return;
				}

				const result = await this.synchronizer.synchronizeEvents(
					[readbackEvent],
					new Map([[confirmedDevice.id, confirmedDevice]]),
				);
				this.recordSynchronizationResult(result);
				readbackAccepted = result.acceptedEvents.includes(readbackEvent);

				if (readbackAccepted) {
					this.recordAcceptedCapabilityEvents(result.acceptedEvents, generation);
				}
			});
			const synchronized = await this.settleWithin(synchronization, HOMEY_COMMAND_WRITE_TIMEOUT_MS);

			if (synchronized.status !== 'fulfilled') {
				return false;
			}

			return readbackAccepted && this.isCurrentGeneration(connector, generation);
		} finally {
			this.removePendingCommandConfirmation(key, pending);
		}
	}

	private settleWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<HomeyBoundedResult<T>> {
		return new Promise((resolve) => {
			let settled = false;
			const complete = (result: HomeyBoundedResult<T>): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				this.commandCancellationListeners.delete(cancel);
				resolve(result);
			};
			const cancel = (): void => complete({ status: 'cancelled' });
			const timer = setTimeout(() => complete({ status: 'timed_out' }), timeoutMs);
			this.commandCancellationListeners.add(cancel);
			void operation.then(
				(value) => complete({ status: 'fulfilled', value }),
				() => complete({ status: 'rejected' }),
			);
		});
	}

	private recordAcceptedCapabilityEvents(events: readonly HomeyEvent[], generation: number): void {
		for (const event of events) {
			if (event.type !== HomeyEventType.CAPABILITY_VALUE_CHANGED) {
				continue;
			}

			const key = this.commandKey(event.deviceId, event.capabilityId);
			const device = this.devices.get(event.deviceId);

			if (device !== undefined) {
				this.setDevice({
					...device,
					capabilities: device.capabilities.map((capability) =>
						capability.id === event.capabilityId
							? { ...capability, value: event.value, lastUpdatedAt: event.lastUpdatedAt }
							: capability,
					),
				});
			}
			this.acceptedCapabilityStates.set(key, {
				revision: ++this.acceptedCapabilityRevision,
				value: event.value,
			});
			const pending = this.pendingCommandConfirmations.get(key);
			const observationRevision = (event as ObservedHomeyEvent)[HOMEY_EVENT_OBSERVATION_REVISION] ?? 0;

			if (
				pending !== undefined &&
				pending.generation === generation &&
				observationRevision > pending.observationRevision &&
				homeyCapabilityValuesEqual(pending.value, event.value)
			) {
				this.pendingCommandConfirmations.delete(key);
				pending.resolve(true);
			}
		}
	}

	private recordCapabilityEvidence(values: readonly HomeyAcceptedCapabilityValue[]): void {
		for (const value of values) {
			this.acceptedCapabilityStates.set(this.commandKey(value.deviceId, value.capabilityId), {
				revision: ++this.acceptedCapabilityRevision,
				value: value.value,
			});
		}
	}

	private removePendingCommandConfirmation(key: string, pending: PendingHomeyCommandConfirmation): void {
		if (this.pendingCommandConfirmations.get(key) === pending) {
			this.pendingCommandConfirmations.delete(key);
		}
	}

	private cancelCommandOperations(): void {
		for (const pending of this.pendingCommandConfirmations.values()) {
			pending.resolve(false);
		}
		this.pendingCommandConfirmations.clear();

		for (const cancel of [...this.commandCancellationListeners]) {
			cancel();
		}
		this.commandCancellationListeners.clear();
	}

	private commandKey(deviceId: string, capabilityId: string): string {
		return `${deviceId}\u0000${capabilityId}`;
	}

	private async settleSynchronization(operation: Promise<void>): Promise<void> {
		try {
			await operation;
		} catch {
			// Callers observe the failure while the serialization queue stays usable.
		}
	}

	private async cleanupPreviousGeneration(): Promise<void> {
		if (!this.hasRuntimeResources()) {
			return;
		}

		this.generation += 1;

		if (!(await this.cleanupRuntime())) {
			throw new Error('Homey service could not clean up its previous connector');
		}
	}

	private async cleanupRuntime(): Promise<boolean> {
		this.clearReconciliationTimer();
		this.clearReconnectTimer();
		this.clearLiveEventFlush();
		this.startupEvents = null;
		this.cancelCommandOperations();
		const unsubscribe = this.unsubscribe;
		const connector = this.connector;
		let unsubscribeSucceeded = true;
		let disconnectSucceeded = connector === null;

		if (unsubscribe) {
			try {
				await unsubscribe();
				this.unsubscribe = null;
			} catch {
				unsubscribeSucceeded = false;
			}
		}

		await this.synchronizationTail;
		this.synchronizer.reset();
		this.capabilityCommandRevisions.clear();
		this.capabilityObservationRevisions.clear();
		this.deviceInventoryRevisions.clear();
		this.acceptedCapabilityStates.clear();

		if (connector) {
			try {
				await connector.disconnect();
				disconnectSucceeded = true;
			} catch {
				disconnectSucceeded = false;
			}
		}
		if (disconnectSucceeded && (unsubscribeSucceeded || connector !== null)) {
			this.unsubscribe = null;
			this.connector = null;
			this.systemInfo = null;
			this.zones = [];
			this.devices.clear();
		}

		return disconnectSucceeded && (unsubscribeSucceeded || connector !== null);
	}

	private clearReconciliationTimer(): void {
		if (this.reconciliationTimer) {
			clearTimeout(this.reconciliationTimer);
			this.reconciliationTimer = null;
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearLiveEventFlush(): void {
		if (this.liveEventFlush !== null) {
			clearImmediate(this.liveEventFlush);
			this.liveEventFlush = null;
		}

		this.liveEvents = [];
	}

	private hasRuntimeResources(): boolean {
		return (
			this.connector !== null ||
			this.unsubscribe !== null ||
			this.reconciliationTimer !== null ||
			this.reconnectTimer !== null ||
			this.liveEventFlush !== null
		);
	}

	private recordSynchronizationResult(result: HomeySynchronizationResult): void {
		if (result.failed > 0) {
			this.logRateLimitedFailure(
				'synchronization-result',
				'warn',
				'Homey synchronization completed with isolated property failures',
				{
					failed: result.failed,
				},
			);
		}
	}

	private recordOperationalDiagnostics(diagnostics: HomeyOperationalDiagnostics): void {
		this.operationalDiagnostics = diagnostics;
	}

	private async refreshOperationalDiagnostics(devices: readonly HomeyDevice[]): Promise<void> {
		const revision = this.operationalDiagnosticsRevision;
		const diagnostics = await this.synchronizer.getOperationalDiagnostics(devices);
		const upstreamIds = new Set(devices.map((device) => device.id));
		this.operationalInventoryDeviceIds = upstreamIds;

		if (revision === this.operationalDiagnosticsRevision) {
			this.recordOperationalDiagnostics(diagnostics);
			return;
		}

		const adoptedDevices = this.operationalDiagnostics.adoptedDevices;
		this.recordOperationalDiagnostics({
			...diagnostics,
			adopted: adoptedDevices.length,
			adoptedDevices,
			missing: adoptedDevices.filter((device) => !upstreamIds.has(device.homeyDeviceId)).length,
		});
	}

	private recordLocalAdoptedDiagnostics(adoptedDevices: ReadonlyMap<string, string>): void {
		const adopted = [...adoptedDevices].map(([panelDeviceId, homeyDeviceId]) => ({ panelDeviceId, homeyDeviceId }));
		this.operationalDiagnosticsRevision += 1;
		this.operationalDiagnostics = {
			...this.operationalDiagnostics,
			adopted: adopted.length,
			adoptedDevices: adopted,
			missing: adopted.filter((device) => !this.operationalInventoryDeviceIds.has(device.homeyDeviceId)).length,
		};
	}

	private async runInventoryReconciliation(
		source: HomeyReconciliationSource,
		operation: () => Promise<void>,
	): Promise<void> {
		const startedAt = Date.now();
		this.reconciliationCount += 1;

		try {
			await operation();
			this.lastReconciliationDurationMs = Math.max(0, Date.now() - startedAt);
			this.logger.log('Homey inventory reconciliation completed', {
				adopted: this.operationalDiagnostics.adopted,
				count: this.reconciliationCount,
				deviceCount: this.devices.size,
				durationMs: this.lastReconciliationDurationMs,
				failureCount: this.reconciliationFailureCount,
				missing: this.operationalDiagnostics.missing,
				source,
				unavailable: this.operationalDiagnostics.unavailable,
				unsupported: this.operationalDiagnostics.unsupported,
			});
		} catch (error) {
			this.reconciliationFailureCount += 1;
			this.lastReconciliationDurationMs = Math.max(0, Date.now() - startedAt);
			this.logRateLimitedFailure('reconciliation', 'warn', 'Homey inventory reconciliation attempt failed', {
				count: this.reconciliationCount,
				durationMs: this.lastReconciliationDurationMs,
				failureCount: this.reconciliationFailureCount,
				source,
			});

			throw error;
		}
	}

	private isCurrentGeneration(connector: HomeyConnector, generation: number): boolean {
		return this.connector === connector && this.generation === generation;
	}

	private applyFailureState(
		error: unknown,
		fallback: string,
		transientState: HomeyConnectionState = HomeyConnectionState.ERROR,
	): void {
		this.healthy = false;
		this.lastErrorCategory = error instanceof HomeyConnectorError ? error.category : null;

		if (error instanceof HomeyConnectorError) {
			switch (error.category) {
				case HomeyConnectorErrorCategory.AUTHENTICATION:
				case HomeyConnectorErrorCategory.AUTHORIZATION:
					this.transitionConnectionState(HomeyConnectionState.AUTHENTICATION_FAILED, 'authentication_failed');
					this.lastError = 'Homey authentication or authorization failed';
					this.logRateLimitedFailure(
						'authentication',
						'warn',
						'Homey reconnect retries suspended until configuration changes',
						{ category: error.category },
					);
					return;
				case HomeyConnectorErrorCategory.TIMEOUT:
				case HomeyConnectorErrorCategory.UNAVAILABLE:
					this.transitionConnectionState(transientState, 'transient_failure');
					this.lastError = 'Homey connection is temporarily unavailable';
					return;
				default:
					this.transitionConnectionState(HomeyConnectionState.ERROR, 'connector_failure');
					this.lastError = fallback;
					return;
			}
		}

		this.transitionConnectionState(HomeyConnectionState.ERROR, 'unexpected_failure');
		this.lastError = fallback;
	}

	private markRuntimeHealthy(connector: HomeyConnector, generation: number): void {
		if (!this.isCurrentGeneration(connector, generation)) {
			return;
		}

		const recovered = this.connectionState !== HomeyConnectionState.CONNECTED;
		this.clearReconnectTimer();
		this.reconnectAttempt = 0;
		this.transitionConnectionState(HomeyConnectionState.CONNECTED, 'runtime_healthy');
		this.healthy = true;
		this.lastError = null;
		this.lastErrorCategory = null;

		if (recovered && this.state === 'started') {
			this.scheduleReconciliation(generation);
		}
	}

	private isRetryableFailure(error: unknown): boolean {
		return error instanceof HomeyConnectorError && error.retryable;
	}

	private isDegradableSubscriptionFailure(error: unknown): error is HomeyConnectorError {
		return (
			error instanceof HomeyConnectorError &&
			error.category !== HomeyConnectorErrorCategory.AUTHENTICATION &&
			error.category !== HomeyConnectorErrorCategory.AUTHORIZATION &&
			error.category !== HomeyConnectorErrorCategory.VALIDATION
		);
	}

	private markRuntimeDegraded(error: HomeyConnectorError, generation: number): void {
		this.transitionConnectionState(HomeyConnectionState.DEGRADED_POLLING, 'subscription_unavailable');
		this.healthy = false;
		this.lastErrorCategory = error.category;
		this.lastError = error.retryable
			? 'Homey event subscription is temporarily unavailable; polling is active'
			: 'Homey event subscription is unavailable; polling is active';
		this.scheduleReconciliation(generation);

		if (error.retryable) {
			this.scheduleReconnect(generation, true);
		}
	}

	private handleRuntimeFailure(error: unknown, fallback: string, generation: number): void {
		this.applyFailureState(error, fallback, HomeyConnectionState.RECONNECTING);

		if (this.isRetryableFailure(error)) {
			this.scheduleReconnect(generation);
		} else {
			this.clearReconciliationTimer();
		}
	}

	private resetReconnectState(): void {
		this.clearReconnectTimer();
		this.reconnectAttempt = 0;
	}

	private resetRuntimeHealth(): void {
		this.failureLogLimiter.reset();
		this.lastSystemInfo = null;
		this.lastConnectedAt = null;
		this.lastInventorySyncAt = null;
		this.lastEventAt = null;
		this.lastErrorCategory = null;
		this.reconnectCount = 0;
		this.reconciliationCount = 0;
		this.reconciliationFailureCount = 0;
		this.lastReconciliationDurationMs = null;
		this.operationalDiagnostics = { adopted: 0, adoptedDevices: [], missing: 0, unsupported: 0, unavailable: 0 };
		this.operationalInventoryDeviceIds.clear();
		this.operationalDiagnosticsRevision = 0;
	}

	private recordSuccessfulConnection(): void {
		this.lastConnectedAt = this.now();
	}

	private recordSuccessfulInventorySync(connector: HomeyConnector, generation: number): void {
		if (this.isCurrentGeneration(connector, generation)) {
			this.lastInventorySyncAt = this.now();
		}
	}

	private now(): string {
		return new Date().toISOString();
	}

	private calculateLastEventAgeMs(): number | null {
		if (this.lastEventAt === null) {
			return null;
		}

		return Math.max(0, Date.now() - new Date(this.lastEventAt).getTime());
	}

	private transitionConnectionState(next: HomeyConnectionState, reason: string): void {
		const previous = this.connectionState;

		if (previous === next) {
			return;
		}

		this.connectionState = next;
		this.logger.log('Homey connection state changed', { from: previous, reason, to: next });
	}

	private logRateLimitedFailure(
		key: string,
		level: 'error' | 'warn',
		message: string,
		context: Record<string, unknown>,
	): void {
		const decision = this.failureLogLimiter.consume(key);

		if (decision.log) {
			this.logger[level](message, { ...context, suppressed: decision.suppressed });
		}
	}

	private getCurrentPluginConfigOrDefault(): HomeyConfigModel {
		try {
			return this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		} catch {
			return new HomeyConfigModel();
		}
	}

	private isConfigured(config: HomeyConfigModel): boolean {
		return (
			typeof config.url === 'string' &&
			config.url.trim().length > 0 &&
			typeof config.apiKey === 'string' &&
			config.apiKey.trim().length > 0
		);
	}
}
