import si, { Systeminformation } from 'systeminformation';

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';
import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	RegisteredDevice,
	ShelliesAdapterCallbacks,
	ShelliesLibrary,
	ShellyDevice,
} from '../interfaces/shellies.interface';
import shellies from '../lib/shellies';
import { ShellyV1ConfigModel } from '../models/config.model';

import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

@Injectable()
export class ShelliesAdapterService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShelliesAdapterService',
	);

	private shellies: ShelliesLibrary | null = null;
	private isStarted = false;

	private pluginConfig: ShellyV1ConfigModel | null = null;
	private statusCheckRunning = false;

	/**
	 * Registry of discovered devices
	 * Key: device ID, Value: device info (id, type, host)
	 */
	private readonly devicesRegistry = new Map<string, RegisteredDevice>();

	private callbacks: ShelliesAdapterCallbacks = {};

	constructor(
		private readonly configService: ConfigService,
		private readonly httpClient: ShellyV1HttpClientService,
	) {}

	/**
	 * Set callbacks for adapter events
	 */
	setCallbacks(callbacks: ShelliesAdapterCallbacks): void {
		this.callbacks = callbacks;
	}

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

			void this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));

			throw error;
		}
	}

	/**
	 * Stop the shellies library and cleanup
	 */
	stop(): void {
		if (!this.isStarted || !this.shellies) {
			return;
		}

		try {
			this.logger.log('Stopping Shellies adapter');

			// Remove per-device event listeners registered in handleDeviceDiscovered()
			// to prevent listener accumulation across stop/start cycles.
			for (const registeredDevice of this.devicesRegistry.values()) {
				const device = this.shellies.getDevice(registeredDevice.type, registeredDevice.id);

				if (device) {
					device.removeAllListeners();
				}
			}

			// Remove shellies-level event listeners
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
		}
	}

	/**
	 * Set authentication credentials for a device
	 */
	setDeviceAuthCredentials(deviceType: string, deviceId: string, username: string, password: string): void {
		const device = this.getDevice(deviceType, deviceId);

		if (device && device.setAuthCredentials) {
			device.setAuthCredentials(username, password);
		} else if (!device) {
			this.logger.warn(`Cannot set auth credentials - device not found: ${deviceId}`, { resource: deviceId });
		}
	}

	/**
	 * Handle device discovered event from a shellies library
	 */
	private handleDeviceDiscovered(device: ShellyDevice): void {
		// Add a device to a registry (default enabled = true, will be updated by mapper)
		this.devicesRegistry.set(device.id, {
			id: device.id,
			type: device.type,
			host: device.host,
			enabled: true,
		});

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

		device.on('stale', () => {});

		device.on('remove', () => {
			this.handleDeviceRemoved(device);
		});

		// Normalize and invoke the discovery callback
		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: device.online,
		};
		void this.callbacks.onDeviceDiscovered?.(normalizedEvent);
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
		const normalizedEvent: NormalizedDeviceChangeEvent = {
			id: device.id,
			property,
			newValue,
			oldValue,
		};

		void this.callbacks.onDeviceChanged?.(normalizedEvent);
	}

	/**
	 * Handle device offline event
	 */
	private handleDeviceOffline(device: ShellyDevice): void {
		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: false,
		};

		void this.callbacks.onDeviceOffline?.(normalizedEvent);
	}

	/**
	 * Handle device online event
	 */
	private handleDeviceOnline(device: ShellyDevice): void {
		const normalizedEvent: NormalizedDeviceEvent = {
			id: device.id,
			type: device.type,
			host: device.host,
			online: true,
		};

		void this.callbacks.onDeviceOnline?.(normalizedEvent);
	}

	/**
	 * Handle device removed event
	 */
	private handleDeviceRemoved(device: ShellyDevice): void {
		// Remove device from registry
		this.devicesRegistry.delete(device.id);
	}

	private get config(): ShellyV1ConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<ShellyV1ConfigModel>(DEVICES_SHELLY_V1_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	/**
	 * Periodically check device status based on the lastSeen timestamp.
	 * This is a workaround because shellies library's stale/offline events don't work properly.
	 *
	 * When a device exceeds the stale timeout, an HTTP ping (/shelly) is attempted
	 * before marking offline. If the device responds, CoAP is broken but the device
	 * is alive — we update lastSeen and keep it online.
	 */
	@Cron(CronExpression.EVERY_5_SECONDS)
	async checkDevicesStatus(): Promise<void> {
		if (!this.isStarted || !this.shellies || this.statusCheckRunning) {
			return;
		}

		this.statusCheckRunning = true;

		try {
			const now = Date.now();
			const staleTimeout = this.config.timeouts.staleTimeout * 1000;

			// Collect stale devices that need an HTTP ping
			const staleCandidates: Array<{ device: ShellyDevice; host: string }> = [];

			for (const registeredDevice of this.devicesRegistry.values()) {
				const device = this.shellies.getDevice(registeredDevice.type, registeredDevice.id);

				if (!device) {
					continue;
				}

				if (device.lastSeen && typeof device.lastSeen === 'number') {
					const timeSinceLastSeen = now - device.lastSeen;

					if (timeSinceLastSeen > staleTimeout && device.online) {
						staleCandidates.push({ device, host: registeredDevice.host });
					}
				}
			}

			if (staleCandidates.length === 0) {
				return;
			}

			// Ping all stale devices concurrently to avoid sequential 3s timeouts
			const results = await Promise.all(
				staleCandidates.map(async ({ device, host }) => {
					const alive = await this.pingDevice(host);

					return { device, alive };
				}),
			);

			const recheckNow = Date.now();

			for (const { device, alive } of results) {
				// Re-check online — another invocation or event may have changed it
				if (!device.online) {
					continue;
				}

				// Re-check lastSeen — CoAP may have resumed during the HTTP ping window
				if (device.lastSeen && typeof device.lastSeen === 'number' && recheckNow - device.lastSeen <= staleTimeout) {
					continue;
				}

				if (alive) {
					this.logger.debug(`Device ${device.id} CoAP stale but HTTP OK, keeping online`, {
						resource: device.id,
					});

					device.lastSeen = Date.now();
				} else {
					this.logger.warn(`Device ${device.id} is stale and unreachable via HTTP, marking as offline`, {
						resource: device.id,
					});

					this.handleDeviceOffline(device);
					device.online = false;
				}
			}
		} catch (error) {
			this.logger.error('Error during device status check', {
				message: error instanceof Error ? error.message : String(error),
			});
		} finally {
			this.statusCheckRunning = false;
		}
	}

	/**
	 * Lightweight HTTP ping via /shelly endpoint (no auth required).
	 * Returns true if the device responds, false on any error/timeout.
	 */
	private async pingDevice(host: string): Promise<boolean> {
		try {
			await this.httpClient.getDeviceInfo(host, 3_000);

			return true;
		} catch {
			return false;
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
