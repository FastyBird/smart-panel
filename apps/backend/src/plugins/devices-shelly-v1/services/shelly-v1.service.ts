import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';
import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	ShelliesAdapterEventType,
} from '../interfaces/shellies.interface';
import { ShellyV1ConfigModel } from '../models/config.model';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';

type ServiceState = 'stopped' | 'starting' | 'started' | 'stopping';

@Injectable()
export class ShellyV1Service {
	private readonly logger = new Logger(ShellyV1Service.name);

	private pluginConfig: ShellyV1ConfigModel | null = null;

	private state: ServiceState = 'stopped';
	private startTimer: NodeJS.Timeout | null = null;

	private desiredEnabled = false;
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly deviceMapper: DeviceMapperService,
	) {}

	async requestStart(delayMs = 1000): Promise<void> {
		this.desiredEnabled = this.config.enabled === true;

		if (!this.desiredEnabled) {
			if (this.startTimer) {
				clearTimeout(this.startTimer);

				this.startTimer = null;
			}

			await this.ensureStopped();

			return;
		}

		if (this.startTimer) {
			clearTimeout(this.startTimer);
		}

		this.startTimer = setTimeout(() => {
			this.startTimer = null;

			void this.ensureStarted();
		}, delayMs);
	}

	async stop(): Promise<void> {
		if (this.startTimer) {
			clearTimeout(this.startTimer);

			this.startTimer = null;
		}

		await this.ensureStopped();
	}

	async restart(): Promise<void> {
		await this.stop();
		await this.requestStart();
	}

	private async ensureStarted(): Promise<void> {
		await this.withLock(async () => {
			if (this.config.enabled !== true) {
				return;
			}

			switch (this.state) {
				case 'started':
					return;
				case 'starting':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					break;
				case 'stopped':
					break;
			}

			this.state = 'starting';

			this.logger.log('Starting Shelly V1 plugin service');

			try {
				// Start the shellies adapter for device discovery
				this.shelliesAdapter.start();

				this.logger.log('Shelly V1 plugin service started successfully');

				this.state = 'started';
			} catch (error) {
				this.logger.error('Failed to start Shelly V1 plugin service', error);

				this.state = 'stopped';

				throw error;
			}
		});
	}

	private async ensureStopped(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					await this.waitUntil('stopped');

					return;
				case 'starting':
					await this.waitUntil('started', 'stopped');
					break;
				case 'started':
					break;
			}

			if (this.state !== 'started') {
				return;
			}

			this.state = 'stopping';

			this.logger.log('Stopping Shelly V1 plugin service');

			try {
				// Stop the shellies adapter
				this.shelliesAdapter.stop();

				this.logger.log('Shelly V1 plugin service stopped');

				this.state = 'stopped';
			} catch (error) {
				this.logger.error('Failed to stop Shelly V1 plugin service', error);

				this.state = 'stopped';

				throw error;
			}
		});
	}

	/**
	 * Handle device discovered event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_DISCOVERED)
	async handleDeviceDiscovered(event: NormalizedDeviceEvent): Promise<void> {
		this.logger.log(`Device discovered: ${event.id} (${event.type}) at ${event.host}`);

		try {
			// Map and create the device with its channels and properties
			const device = await this.deviceMapper.mapDevice(event);

			this.logger.log(`Device mapped successfully: ${device.identifier} (${device.id})`);
		} catch (error) {
			this.logger.error(`Failed to map device ${event.id}:`, error);
		}
	}

	/**
	 * Handle device property change event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_CHANGED)
	handleDeviceChanged(event: NormalizedDeviceChangeEvent): void {
		this.logger.debug(`Device ${event.id} property changed: ${event.property}`);

		// TODO: Step 4 - Implement property updates
	}

	/**
	 * Handle device offline event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_OFFLINE)
	handleDeviceOffline(event: NormalizedDeviceEvent): void {
		this.logger.debug(`Device went offline: ${event.id}`);

		// TODO: Step 4 - Implement online/offline handling
	}

	/**
	 * Handle device online event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.DEVICE_ONLINE)
	handleDeviceOnline(event: NormalizedDeviceEvent): void {
		this.logger.debug(`Device came online: ${event.id}`);

		// TODO: Step 4 - Implement online/offline handling
	}

	/**
	 * Handle error event from the shellies adapter
	 */
	@OnEvent(ShelliesAdapterEventType.ERROR)
	handleAdapterError(error: Error): void {
		this.logger.error('Shellies adapter error', error);
	}

	@OnEvent(`${ConfigModuleEventType.CONFIG_UPDATED}.${DEVICES_SHELLY_V1_PLUGIN_NAME}`)
	async handleConfigUpdated(): Promise<void> {
		this.logger.log('Config updated, restarting service');

		await this.restart();
	}

	private get config(): ShellyV1ConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyV1ConfigModel>(DEVICES_SHELLY_V1_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	private async withLock<T>(fn: () => Promise<T>): Promise<T> {
		const previousLock = this.startStopLock;

		let releaseLock: () => void;

		this.startStopLock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		try {
			await previousLock;

			return await fn();
		} finally {
			releaseLock();
		}
	}

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
