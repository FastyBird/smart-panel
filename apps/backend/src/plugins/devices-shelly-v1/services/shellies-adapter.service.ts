import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	ShelliesAdapterEventType,
	ShelliesLibrary,
	ShellyDevice,
} from '../interfaces/shellies.interface';
import shellies from '../lib/shellies';

@Injectable()
export class ShelliesAdapterService {
	private readonly logger = new Logger(ShelliesAdapterService.name);

	private shellies: ShelliesLibrary | null = null;
	private isStarted = false;

	constructor(private readonly eventEmitter: EventEmitter2) {}

	/**
	 * Start the shellies library and begin device discovery
	 */
	start(): void {
		if (this.isStarted) {
			this.logger.warn('Shellies adapter already started');

			return;
		}

		try {
			this.logger.log('Starting Shellies adapter for Gen 1 devices');

			// Initialize the shellies library
			this.shellies = shellies;

			// Register event handlers
			const deviceDiscoveredHandler = (device: ShellyDevice): void => this.handleDeviceDiscovered(device);

			this.shellies.on('discover', deviceDiscoveredHandler);
			this.shellies.on('add', deviceDiscoveredHandler); // Synonym in Gen 1

			this.logger.log('Shellies library initialized, starting discovery');

			// Start discovery
			this.shellies.start();

			this.isStarted = true;

			this.logger.log('Shellies adapter started successfully');
		} catch (error) {
			this.logger.error('Failed to start Shellies adapter', error);

			this.eventEmitter.emit(ShelliesAdapterEventType.ERROR, error);

			throw error;
		}
	}

	/**
	 * Stop the shellies library and cleanup
	 */
	stop(): void {
		if (!this.isStarted || !this.shellies) {
			this.logger.debug('Shellies adapter not started, nothing to stop');

			return;
		}

		try {
			this.logger.log('Stopping Shellies adapter');

			// Remove all event listeners
			this.shellies.removeAllListeners();

			// Stop discovery
			this.shellies.stop();

			this.shellies = null;
			this.isStarted = false;

			this.logger.log('Shellies adapter stopped successfully');
		} catch (error) {
			this.logger.error('Failed to stop Shellies adapter', error);

			throw error;
		}
	}

	/**
	 * Get a device by ID
	 */
	getDevice(id: string): ShellyDevice | undefined {
		if (!this.shellies) {
			return undefined;
		}

		return this.shellies.getDevice(id);
	}

	/**
	 * Get all discovered devices
	 */
	getDevices(): ShellyDevice[] {
		if (!this.shellies) {
			return [];
		}

		return this.shellies.getDevices();
	}

	/**
	 * Check if the adapter is started
	 */
	isActive(): boolean {
		return this.isStarted;
	}

	/**
	 * Handle device discovered event from shellies library
	 */
	private handleDeviceDiscovered(device: ShellyDevice): void {
		this.logger.debug(`Device discovered: ${device.id} (${device.type})`);

		// Register device-specific event handlers
		device.on('change', (property: string, newValue: any, oldValue: any) => {
			this.handleDeviceChange(device, property, newValue, oldValue);
		});

		device.on('offline', () => {
			this.handleDeviceOffline(device);
		});

		device.on('online', () => {
			this.handleDeviceOnline(device);
		});

		// Normalize and emit the discovery event
		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: device.online,
			device, // Keep raw device reference for commands
		};

		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_DISCOVERED, normalizedEvent);
	}

	/**
	 * Handle device property change event
	 */
	private handleDeviceChange(device: ShellyDevice, property: string, newValue: unknown, oldValue: unknown): void {
		this.logger.debug(`Device ${device.id} property changed: ${property}`);

		const normalizedEvent: NormalizedDeviceChangeEvent = {
			id: device.id,
			property,
			newValue,
			oldValue,
			device,
		};

		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_CHANGED, normalizedEvent);
	}

	/**
	 * Handle device offline event
	 */
	private handleDeviceOffline(device: ShellyDevice): void {
		this.logger.debug(`Device went offline: ${device.id}`);

		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: false,
			device,
		};

		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_OFFLINE, normalizedEvent);
	}

	/**
	 * Handle device online event
	 */
	private handleDeviceOnline(device: ShellyDevice): void {
		this.logger.debug(`Device came online: ${device.id}`);

		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: true,
			device,
		};

		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_ONLINE, normalizedEvent);
	}
}
