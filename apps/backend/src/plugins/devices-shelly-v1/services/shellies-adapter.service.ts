import si, { Systeminformation } from 'systeminformation';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';
import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	RegisteredDevice,
	ShelliesAdapterEventType,
	ShelliesLibrary,
	ShellyDevice,
} from '../interfaces/shellies.interface';
import shellies from '../lib/shellies';
import { ShellyV1ConfigModel } from '../models/config.model';

@Injectable()
export class ShelliesAdapterService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShelliesAdapterService',
	);

	private shellies: ShelliesLibrary | null = null;
	private isStarted = false;

	private pluginConfig: ShellyV1ConfigModel | null = null;

	/**
	 * Registry of discovered devices
	 * Key: device ID, Value: device info (id, type, host)
	 */
	private readonly devicesRegistry = new Map<string, RegisteredDevice>();

	constructor(
		private readonly configService: ConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Start the shellies library and begin device discovery
	 */
	async start(): Promise<void> {
		if (this.isStarted) {
			this.logger.warn('Shellies adapter already started');

			return;
		}

		try {
			this.logger.log('Starting Shellies adapter for Gen 1 devices');

			// Initialize the shellies library
			this.shellies = shellies;

			shellies.request.timeout(this.config.timeouts.requestTimeout * 1000);
			shellies.staleTimeout = this.config.timeouts.staleTimeout * 1000;

			// Register event handlers
			const deviceDiscoveredHandler = (device: ShellyDevice): void => this.handleDeviceDiscovered(device);

			//this.shellies.on('discover', deviceDiscoveredHandler);
			this.shellies.on('add', deviceDiscoveredHandler); // Synonym in Gen 1

			this.logger.log('Shellies library initialized, starting discovery');

			// Get network interface if configured
			const networkInterface = await this.getNetworkInterface();

			// Start discovery
			this.shellies.start(networkInterface);

			this.isStarted = true;

			this.logger.log('Shellies adapter started successfully');
		} catch (error) {
			this.logger.error('Failed to start Shellies adapter', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

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

			// Clear devices registry
			this.devicesRegistry.clear();

			this.shellies = null;
			this.isStarted = false;

			this.logger.log('Shellies adapter stopped successfully');
		} catch (error) {
			this.logger.error('Failed to stop Shellies adapter', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			throw error;
		}
	}

	/**
	 * Get a device by ID
	 */
	getDevice(type: string, id: string): ShellyDevice | undefined {
		if (!this.shellies) {
			return undefined;
		}

		return this.shellies.getDevice(type, id);
	}

	/**
	 * Get all registered devices
	 */
	getRegisteredDevices(): RegisteredDevice[] {
		return Array.from(this.devicesRegistry.values());
	}

	/**
	 * Get a registered device by ID
	 */
	getRegisteredDevice(deviceId: string): RegisteredDevice | undefined {
		return this.devicesRegistry.get(deviceId);
	}

	/**
	 * Update the enabled flag for a registered device
	 */
	updateDeviceEnabledStatus(deviceId: string, enabled: boolean): void {
		const device = this.devicesRegistry.get(deviceId);

		if (device) {
			device.enabled = enabled;
			this.devicesRegistry.set(deviceId, device);

			this.logger.debug(`Updated enabled status for ${deviceId}: ${enabled}`);
		}
	}

	/**
	 * Set authentication credentials for a device
	 */
	setDeviceAuthCredentials(deviceType: string, deviceId: string, username: string, password: string): void {
		const device = this.getDevice(deviceType, deviceId);

		if (device && device.setAuthCredentials) {
			device.setAuthCredentials(username, password);

			this.logger.debug(`Set auth credentials for ${deviceId} (username: ${username})`);
		} else if (!device) {
			this.logger.warn(`Cannot set auth credentials - device not found: ${deviceId}`);
		}
	}

	/**
	 * Handle device discovered event from a shellies library
	 */
	private handleDeviceDiscovered(device: ShellyDevice): void {
		this.logger.debug(`Device discovered: ${device.id} (${device.type})`);

		// Add a device to a registry (default enabled = true, will be updated by mapper)
		this.devicesRegistry.set(device.id, {
			id: device.id,
			type: device.type,
			host: device.host,
			enabled: true,
		});

		this.logger.debug(`Device registered: ${device.id} (${this.devicesRegistry.size} total devices)`);

		// Register device-specific event handlers
		device.on(
			'change',
			(property: string, newValue: string | number | boolean, oldValue: string | number | boolean | null) => {
				this.handleDeviceChange(device, property, newValue, oldValue);
			},
		);

		device.on('offline', () => {
			this.handleDeviceOffline(device);
		});

		device.on('online', () => {
			this.handleDeviceOnline(device);
		});

		device.on('stale', () => {
			this.logger.debug(`Device stale: ${device.id}`);
		});

		device.on('remove', () => {
			this.handleDeviceRemoved(device);
		});

		// Normalize and emit the discovery event
		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: device.online,
		};
		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_DISCOVERED, normalizedEvent);
	}

	/**
	 * Handle device property change event
	 */
	private handleDeviceChange(
		device: ShellyDevice,
		property: string,
		newValue: string | number | boolean,
		oldValue: string | number | boolean | null,
	): void {
		this.logger.debug(`Device ${device.id} property changed: ${property}`);

		const normalizedEvent: NormalizedDeviceChangeEvent = {
			id: device.id,
			property,
			newValue,
			oldValue,
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
		};

		this.eventEmitter.emit(ShelliesAdapterEventType.DEVICE_ONLINE, normalizedEvent);
	}

	/**
	 * Handle device removed event
	 */
	private handleDeviceRemoved(device: ShellyDevice): void {
		this.logger.debug(`Device removed: ${device.id}`);

		// Remove device from registry
		this.devicesRegistry.delete(device.id);

		this.logger.debug(`Device unregistered: ${device.id} (${this.devicesRegistry.size} total devices)`);
	}

	private get config(): ShellyV1ConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyV1ConfigModel>(DEVICES_SHELLY_V1_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Periodically check device status based on the lastSeen timestamp
	 * This is a workaround because shellies library's stale/offline events don't work properly
	 */
	@Cron(CronExpression.EVERY_5_SECONDS)
	checkDevicesStatus(): void {
		if (!this.isStarted || !this.shellies) {
			return;
		}

		const now = Date.now();
		const staleTimeout = this.config.timeouts.staleTimeout * 1000;

		this.logger.debug(`Checking status of ${this.devicesRegistry.size} registered devices`);

		for (const registeredDevice of this.devicesRegistry.values()) {
			try {
				const device = this.shellies.getDevice(registeredDevice.type, registeredDevice.id);
				if (!device) {
					this.logger.warn(`Device ${registeredDevice.id} not found in shellies library`);
					continue;
				}

				// Check if a device has exceeded the stale timeout
				if (device.lastSeen && typeof device.lastSeen === 'number') {
					const timeSinceLastSeen = now - device.lastSeen;

					if (timeSinceLastSeen > staleTimeout && device.online) {
						this.logger.warn(
							`Device ${device.id} is stale (${Math.round(timeSinceLastSeen / 1000)}s since last seen, threshold: ${this.config.timeouts.staleTimeout}s), marking as offline`,
						);

						// Manually trigger offline event since shellies library events don't work properly
						this.handleDeviceOffline(device);
						// Prevent re-triggering by updating the device's online status in memory
						device.online = false;
					}
				}
			} catch (error) {
				this.logger.error(`Error checking device status for ${registeredDevice.id}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	/**
	 * Returns the configured network interface IP address to listen for CoAP messages on,
	 * if one has been configured.
	 */
	async getNetworkInterface(): Promise<string | null> {
		const iface = this.config.discovery.interface;

		if (!iface) {
			return null;
		}

		const networkInterfaces: Systeminformation.NetworkInterfacesData[] = await si.networkInterfaces();

		// Check if the configured value matches any interface name
		const interfaceByName = networkInterfaces.find((ni) => ni.iface === iface);

		if (interfaceByName) {
			// Return the IPv4 address of the matching interface
			return interfaceByName.ip4 || null;
		}

		// Otherwise, check if the configured value is an IP address that exists on any interface
		const interfaceByAddress = networkInterfaces.find((ni) => ni.ip4 === iface);

		if (interfaceByAddress) {
			// Address found, so it's valid
			return interfaceByAddress.ip4;
		}

		// The configured value doesn't match any interface name or address, so ignore it
		this.logger.warn(`Ignoring unknown network interface name or address: ${iface}`);

		return null;
	}
}
