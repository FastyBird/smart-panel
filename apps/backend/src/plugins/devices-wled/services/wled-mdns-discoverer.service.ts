import Bonjour, { Service, Browser } from 'bonjour-service';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { WledMdnsDiscoveredDevice, WledMdnsEventType } from '../interfaces/wled.interface';

/**
 * WLED mDNS Discoverer Service
 *
 * Discovers WLED devices on the local network using mDNS/Bonjour.
 * WLED devices advertise themselves via the _wled._tcp service type.
 */
@Injectable()
export class WledMdnsDiscovererService implements OnModuleDestroy {
	private readonly logger = new Logger(WledMdnsDiscovererService.name);

	private bonjour: Bonjour | null = null;
	private browser: Browser | null = null;
	private discoveredDevices = new Map<string, WledMdnsDiscoveredDevice>();
	private isRunning = false;

	constructor(private readonly eventEmitter: EventEmitter2) {}

	/**
	 * Start mDNS discovery for WLED devices
	 */
	async start(networkInterface?: string): Promise<void> {
		if (this.isRunning) {
			this.logger.warn('[WLED][MDNS] Discovery is already running');
			return;
		}

		this.logger.log('[WLED][MDNS] Starting mDNS discovery for WLED devices');

		try {
			// Create Bonjour instance
			this.bonjour = new Bonjour(
				networkInterface ? { interface: networkInterface } : undefined,
			);

			// Browse for _wled._tcp services
			this.browser = this.bonjour.find({ type: 'wled' }, (service: Service) => {
				this.handleServiceFound(service);
			});

			// Handle browser errors
			this.browser.on('error', (error: Error) => {
				this.logger.error('[WLED][MDNS] Browser error', {
					message: error.message,
					stack: error.stack,
				});
			});

			this.isRunning = true;
			this.logger.log('[WLED][MDNS] mDNS discovery started');
		} catch (error) {
			this.logger.error('[WLED][MDNS] Failed to start mDNS discovery', {
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

		this.logger.log('[WLED][MDNS] Stopping mDNS discovery');

		if (this.browser) {
			this.browser.stop();
			this.browser = null;
		}

		if (this.bonjour) {
			this.bonjour.destroy();
			this.bonjour = null;
		}

		this.isRunning = false;
		this.logger.log('[WLED][MDNS] mDNS discovery stopped');
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
			this.logger.warn('[WLED][MDNS] Discovered service without valid address', {
				name: service.name,
			});
			return;
		}

		// Check if already discovered
		if (this.discoveredDevices.has(host)) {
			this.logger.debug(`[WLED][MDNS] Device already discovered: ${host}`);
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

		this.logger.log(`[WLED][MDNS] Discovered WLED device: ${device.name} at ${host}${mac ? ` (MAC: ${mac})` : ''}`);

		// Emit discovery event
		this.eventEmitter.emit(WledMdnsEventType.DEVICE_DISCOVERED, device);
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
