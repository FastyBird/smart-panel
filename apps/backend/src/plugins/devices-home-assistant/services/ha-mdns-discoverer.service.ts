import Bonjour, { Browser, Service } from 'bonjour-service';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

export enum HaMdnsEventType {
	INSTANCE_DISCOVERED = 'devices-home-assistant.mdns.instance.discovered',
}

export interface HaMdnsDiscoveredInstance {
	hostname: string;
	port: number;
	name: string;
	version?: string;
	uuid?: string;
}

/**
 * Home Assistant mDNS Discoverer Service
 *
 * Discovers Home Assistant instances on the local network using mDNS/Bonjour.
 * Home Assistant advertises itself via the _home-assistant._tcp service type.
 */
@Injectable()
export class HaMdnsDiscovererService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'MdnsDiscoverer',
	);

	private bonjour: Bonjour | null = null;
	private browser: Browser | null = null;
	private discoveredInstances = new Map<string, HaMdnsDiscoveredInstance>();
	private isRunning = false;

	constructor(private readonly eventEmitter: EventEmitter2) {}

	/**
	 * Start discovery automatically on module init
	 */
	onModuleInit(): void {
		this.start();
	}

	/**
	 * Start mDNS discovery for Home Assistant instances
	 */
	start(): void {
		if (this.isRunning) {
			return;
		}

		this.logger.log('Starting mDNS discovery for Home Assistant instances');

		try {
			this.bonjour = new Bonjour();

			// Browse for _home-assistant._tcp services
			this.browser = this.bonjour.find({ type: 'home-assistant' }, (service: Service) => {
				this.handleServiceFound(service);
			});

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

			// Clean up any partially created resources to prevent orphaned instances
			if (this.browser) {
				try {
					this.browser.stop();
				} catch {
					// Ignore cleanup errors
				}
				this.browser = null;
			}

			if (this.bonjour) {
				try {
					this.bonjour.destroy();
				} catch {
					// Ignore cleanup errors
				}
				this.bonjour = null;
			}
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
	 * Restart discovery to find new instances
	 * Keeps existing discovered instances - they will be updated if re-discovered
	 */
	refresh(): void {
		this.stop();
		this.start();
	}

	/**
	 * Get all discovered instances
	 */
	getDiscoveredInstances(): HaMdnsDiscoveredInstance[] {
		return Array.from(this.discoveredInstances.values());
	}

	/**
	 * Check if discovery is running
	 */
	isDiscoveryRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Handle a discovered Home Assistant service
	 */
	private handleServiceFound(service: Service): void {
		const host = this.getHostFromService(service);

		if (!host) {
			return;
		}

		// Create a unique key based on host and port
		const key = `${host}:${service.port || 8123}`;

		if (this.discoveredInstances.has(key)) {
			return;
		}

		// Extract version and UUID from TXT records if available
		const { version, uuid } = this.getTxtRecords(service);

		const instance: HaMdnsDiscoveredInstance = {
			hostname: host,
			port: service.port || 8123,
			name: service.name || 'Home Assistant',
			version,
			uuid,
		};

		this.discoveredInstances.set(key, instance);

		this.logger.log(
			`Discovered Home Assistant instance: ${instance.name} at ${host}:${instance.port}` +
				(version ? ` (version: ${version})` : ''),
		);

		this.eventEmitter.emit(HaMdnsEventType.INSTANCE_DISCOVERED, instance);
	}

	/**
	 * Get host address from service
	 */
	private getHostFromService(service: Service): string | null {
		// Prefer IPv4 address
		if (service.addresses && service.addresses.length > 0) {
			const ipv4 = service.addresses.find((addr) => !addr.includes(':'));
			if (ipv4) {
				return ipv4;
			}
			return service.addresses[0];
		}

		if (service.host) {
			return service.host;
		}

		return null;
	}

	/**
	 * Extract version and UUID from service TXT records
	 */
	private getTxtRecords(service: Service): { version?: string; uuid?: string } {
		if (service.txt && typeof service.txt === 'object') {
			const txt = service.txt as Record<string, string>;
			return {
				version: txt.version || txt.VERSION || undefined,
				uuid: txt.uuid || txt.UUID || undefined,
			};
		}
		return {};
	}

	/**
	 * Cleanup on module destroy
	 */
	onModuleDestroy(): void {
		this.stop();
	}
}
