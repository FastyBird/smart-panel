import Bonjour, { Browser, Service } from 'bonjour-service';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_WLED_PLUGIN_NAME } from '../devices-wled.constants';
import { WledMdnsCallbacks, WledMdnsDiscoveredDevice } from '../interfaces/wled.interface';

/**
 * WLED mDNS Discoverer Service
 *
 * Discovers WLED devices on the local network using mDNS/Bonjour.
 * WLED devices advertise themselves via the _wled._tcp service type.
 */
@Injectable()
export class WledMdnsDiscovererService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(DEVICES_WLED_PLUGIN_NAME, 'MdnsDiscoverer');

	private bonjour: Bonjour | null = null;
	private browser: Browser | null = null;
	private discoveredDevices = new Map<string, WledMdnsDiscoveredDevice>();
	private isRunning = false;

	private callbacks: WledMdnsCallbacks = {};

	/**
	 * Set callbacks for mDNS discovery events
	 */
	setCallbacks(callbacks: WledMdnsCallbacks): void {
		this.callbacks = callbacks;
	}

	/**
	 * Start mDNS discovery for WLED devices
	 * @param _networkInterface Reserved for future use (network interface selection)
	 */
	start(_networkInterface?: string): void {
		if (this.isRunning) {
			this.logger.warn('Discovery is already running');
			return;
		}

		this.logger.log('Starting mDNS discovery for WLED devices');

		try {
			// Create Bonjour instance
			// Note: bonjour-service doesn't support network interface selection in constructor
			// The networkInterface parameter is reserved for future use
			this.bonjour = new Bonjour();

			// Browse for _wled._tcp services
			this.browser = this.bonjour.find({ type: 'wled' }, (service: Service) => {
				this.handleServiceFound(service);
			});

			// Handle browser errors
			this.browser.on('error', (error: Error) => {
				this.logger.error('Browser error', {
					message: error.message,
					stack: error.stack,
				});
			});

			this.isRunning = true;
			this.logger.log('mDNS discovery started');
		} catch (error) {
			this.logger.error('Failed to start mDNS discovery', {
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Stop mDNS discovery
	 */
	stop(): void {
		if (!this.isRunning) {
			return;
		}

		this.logger.log('Stopping mDNS discovery');

		if (this.browser) {
			this.browser.stop();
			this.browser = null;
		}

		if (this.bonjour) {
			this.bonjour.destroy();
			this.bonjour = null;
		}

		this.isRunning = false;
		this.logger.log('mDNS discovery stopped');
	}

	/**
	 * Get all discovered devices
	 */
	getDiscoveredDevices(): WledMdnsDiscoveredDevice[] {
		return Array.from(this.discoveredDevices.values());
	}

	/**
	 * Check if a device has been discovered
	 */
	isDeviceDiscovered(host: string): boolean {
		return this.discoveredDevices.has(host);
	}

	/**
	 * Check if discovery is running
	 */
	isDiscoveryRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Handle a discovered WLED service
	 */
	private handleServiceFound(service: Service): void {
		// Extract device information
		const host = this.getHostFromService(service);

		if (!host) {
			this.logger.warn('Discovered service without valid address', {
				name: service.name,
			});
			return;
		}

		// Check if already discovered
		if (this.discoveredDevices.has(host)) {
			return;
		}

		// Extract MAC address from TXT records if available
		const mac = this.getMacFromService(service);

		const device: WledMdnsDiscoveredDevice = {
			host,
			name: service.name || 'WLED Device',
			mac,
			port: service.port || 80,
		};

		this.discoveredDevices.set(host, device);

		this.logger.log(`Discovered WLED device: ${device.name} at ${host}${mac ? ` (MAC: ${mac})` : ''}`);

		// Invoke discovery callback
		void this.callbacks.onDeviceDiscovered?.(device);
	}

	/**
	 * Get host address from service
	 */
	private getHostFromService(service: Service): string | null {
		// Prefer IPv4 address
		if (service.addresses && service.addresses.length > 0) {
			// Find IPv4 address (doesn't contain ':')
			const ipv4 = service.addresses.find((addr) => !addr.includes(':'));
			if (ipv4) {
				return ipv4;
			}
			// Fall back to first address
			return service.addresses[0];
		}

		// Fall back to host/fqdn
		if (service.host) {
			return service.host;
		}

		return null;
	}

	/**
	 * Extract MAC address from service TXT records
	 */
	private getMacFromService(service: Service): string | undefined {
		if (service.txt && typeof service.txt === 'object') {
			// WLED may include mac in TXT records
			const txt = service.txt as Record<string, string>;
			return txt.mac || txt.MAC || undefined;
		}
		return undefined;
	}

	/**
	 * Cleanup on module destroy
	 */
	onModuleDestroy(): void {
		this.stop();
	}
}
