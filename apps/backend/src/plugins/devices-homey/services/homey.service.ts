import { Inject, Injectable, Optional } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-plugin-service.interface';
import { HomeyConnectorFactory } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import { HomeyUnsubscribe } from '../connectors/homey-connector.types';
import {
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_CONNECTOR_FACTORY,
	HomeyConnectionState,
} from '../devices-homey.constants';
import { HomeyConnectorError, HomeyConnectorErrorCategory } from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';
import { HomeyStatusModel } from '../models/status.model';

@Injectable()
export class HomeyService extends BaseManagedPluginService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyService');

	readonly pluginName = DEVICES_HOMEY_PLUGIN_NAME;
	readonly serviceId = DEVICES_HOMEY_CONNECTOR_SERVICE_ID;

	private pluginConfig: HomeyConfigModel | null = null;
	private lastError: string | null = null;
	private connectionState = HomeyConnectionState.STOPPED;
	private healthy = false;
	private connector: HomeyConnector | null = null;
	private unsubscribe: HomeyUnsubscribe | null = null;
	private systemInfo: HomeySystemInfo | null = null;
	private zones: readonly HomeyZone[] = [];
	private devices = new Map<string, HomeyDevice>();
	private startupEvents: HomeyEvent[] | null = null;
	private generation = 0;
	private synchronizationTail: Promise<void> = Promise.resolve();
	private reconciliationTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly configService: ConfigService,
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
			this.lastError = null;
			this.healthy = false;
			this.connectionState = HomeyConnectionState.CONNECTING;
			const generation = ++this.generation;

			try {
				const config = this.getPluginConfig();
				const connector = this.createConnector(config);
				this.connector = connector;

				await connector.connect();
				await this.synchronizeStartup(connector, generation);

				this.state = 'started';
				this.connectionState = HomeyConnectionState.CONNECTED;
				this.healthy = true;
				this.scheduleReconciliation(generation);
				this.logger.log('Homey connector started and initial inventory synchronized');
			} catch (error) {
				this.applyFailureState(error, 'Homey service failed to start');
				await this.cleanupRuntime();
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
			this.connectionState = HomeyConnectionState.STOPPED;

			const cleaned = await this.cleanupRuntime();

			this.pluginConfig = null;

			if (!cleaned) {
				this.state = 'error';
				this.lastError = 'Homey service failed to stop';
				this.logger.error(this.lastError);

				throw new Error(this.lastError);
			}

			this.state = 'stopped';
			this.lastError = null;
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
		status.lastError = this.lastError;

		return status;
	}

	private getPluginConfig(): HomeyConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	private createConnector(config: HomeyConfigModel): HomeyConnector {
		if (!this.isConfigured(config)) {
			throw new Error('Homey connector configuration is incomplete');
		}

		if (!this.connectorFactory) {
			throw new Error('Homey connector transport is not available');
		}

		return this.connectorFactory.create({
			url: config.url,
			apiKey: config.apiKey,
			connectionTimeout: config.connectionTimeout,
		});
	}

	private async synchronizeStartup(connector: HomeyConnector, generation: number): Promise<void> {
		this.systemInfo = await connector.getSystemInfo();
		this.zones = await connector.getZones();
		this.startupEvents = [];
		this.unsubscribe = await connector.subscribe((event) => this.onConnectorEvent(connector, generation, event));

		await this.enqueueSynchronization(async () => {
			this.replaceDevices(await connector.getDevices());
			await this.reconcileStartupEvents(connector, generation);
		});
	}

	private async reconcileStartupEvents(connector: HomeyConnector, generation: number): Promise<void> {
		let cursor = 0;
		let pass = 0;

		while (this.startupEvents && cursor < this.startupEvents.length && pass < 10) {
			const events = this.startupEvents.slice(cursor);
			cursor += events.length;
			pass += 1;
			await this.reconcileEvents(connector, generation, events);
		}

		const remainingEvents = this.startupEvents?.slice(cursor) ?? [];
		this.startupEvents = null;

		if (remainingEvents.length > 0) {
			await this.reconcileEvents(connector, generation, remainingEvents);
		}
	}

	private onConnectorEvent(connector: HomeyConnector, generation: number, event: HomeyEvent): Promise<void> | void {
		if (!this.isCurrentGeneration(connector, generation)) {
			return;
		}

		if (this.startupEvents) {
			this.startupEvents.push(event);

			return;
		}

		return this.enqueueSynchronization(async () => {
			try {
				await this.reconcileEvents(connector, generation, [event]);
			} catch (error) {
				if (this.isCurrentGeneration(connector, generation)) {
					this.applyFailureState(error, 'Homey event synchronization failed', HomeyConnectionState.DEGRADED_POLLING);
					this.logger.error(this.lastError ?? 'Homey event synchronization failed');
				}
			}
		});
	}

	private async reconcileEvents(
		connector: HomeyConnector,
		generation: number,
		events: readonly HomeyEvent[],
	): Promise<void> {
		if (!this.isCurrentGeneration(connector, generation)) {
			return;
		}

		const containsZoneEvent = events.some((event) => this.isZoneEvent(event));

		if (containsZoneEvent) {
			this.zones = await connector.getZones();
			this.replaceDevices(await connector.getDevices());
		}

		const deviceIds = [...new Set(events.flatMap((event) => ('deviceId' in event ? [event.deviceId] : [])))];

		for (const deviceId of deviceIds) {
			const device = await connector.getDevice(deviceId);

			if (!this.isCurrentGeneration(connector, generation)) {
				return;
			}

			if (device) {
				this.devices.set(device.id, device);
			} else {
				this.devices.delete(deviceId);
			}
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
		this.devices = new Map(devices.map((device) => [device.id, device]));
	}

	private scheduleReconciliation(generation: number): void {
		this.clearReconciliationTimer();

		const interval = this.pluginConfig?.reconciliationInterval;

		if (!interval) {
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
				const [zones, devices] = await Promise.all([connector.getZones(), connector.getDevices()]);

				if (!this.isCurrentGeneration(connector, generation)) {
					return;
				}

				this.zones = zones;
				this.replaceDevices(devices);
				this.connectionState = HomeyConnectionState.CONNECTED;
				this.healthy = true;
				this.lastError = null;
			} catch (error) {
				if (this.isCurrentGeneration(connector, generation)) {
					this.applyFailureState(error, 'Homey inventory reconciliation failed', HomeyConnectionState.DEGRADED_POLLING);
					this.logger.error(this.lastError ?? 'Homey inventory reconciliation failed');
				}
			}
		});

		if (this.isCurrentGeneration(connector, generation) && this.state === 'started') {
			this.scheduleReconciliation(generation);
		}
	}

	private enqueueSynchronization(operation: () => Promise<void>): Promise<void> {
		const result = this.synchronizationTail.then(async () => {
			await operation();
		});
		this.synchronizationTail = this.settleSynchronization(result);

		return result;
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
		this.startupEvents = null;
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

		if (connector) {
			try {
				await connector.disconnect();
				disconnectSucceeded = true;
			} catch {
				disconnectSucceeded = false;
			}
		}

		await this.synchronizationTail;

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

	private hasRuntimeResources(): boolean {
		return this.connector !== null || this.unsubscribe !== null || this.reconciliationTimer !== null;
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

		if (error instanceof HomeyConnectorError) {
			switch (error.category) {
				case HomeyConnectorErrorCategory.AUTHENTICATION:
				case HomeyConnectorErrorCategory.AUTHORIZATION:
					this.connectionState = HomeyConnectionState.AUTHENTICATION_FAILED;
					this.lastError = 'Homey authentication or authorization failed';
					return;
				case HomeyConnectorErrorCategory.TIMEOUT:
				case HomeyConnectorErrorCategory.UNAVAILABLE:
					this.connectionState = transientState;
					this.lastError = 'Homey connection is temporarily unavailable';
					return;
				default:
					this.connectionState = HomeyConnectionState.ERROR;
					this.lastError = fallback;
					return;
			}
		}

		this.connectionState = HomeyConnectionState.ERROR;
		this.lastError = fallback;
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
