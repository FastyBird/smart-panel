import { Bonjour, Service } from 'bonjour-service';
import { readFileSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { API_PREFIX } from '../../../app.constants';
import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { BaseManagedExtensionService } from '../../extensions/services/base-managed-extension.service';
import { ConfigChangeResult } from '../../extensions/services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../../extensions/services/managed-service-manager.service';
import {
	MDNS_DEFAULT_PROTOCOL,
	MDNS_DEFAULT_SERVICE_NAME,
	MDNS_DEFAULT_SERVICE_TYPE,
	MDNS_MODULE_NAME,
} from '../mdns.constants';
import { MdnsConfigModel } from '../models/config.model';

export interface MdnsServiceInfo {
	name: string;
	type: string;
	port: number;
	hostname: string;
	txt: Record<string, string>;
}

@Injectable()
export class MdnsService extends BaseManagedExtensionService implements OnApplicationShutdown {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(MDNS_MODULE_NAME, 'MdnsService');
	private bonjour: Bonjour | null = null;
	private service: Service | null = null;
	private isAdvertising = false;
	private advertisedPort: number = 0;
	private httpServerPort: number | null = null;
	private advertisedServiceName: string | null = null;
	private advertisedServiceType: string | null = null;

	readonly owner = { kind: 'module', type: MDNS_MODULE_NAME } as const;
	readonly serviceId = 'advertisement';

	constructor(
		private readonly configService: ConfigService,
		private readonly managedServiceManager: ManagedServiceManagerService,
	) {
		super();
	}

	/**
	 * Get mDNS configuration from app config
	 */
	private getConfig(): MdnsConfigModel {
		try {
			return this.configService.getModuleConfig<MdnsConfigModel>(MDNS_MODULE_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load mDNS configuration, using defaults',
				error instanceof Error ? error : String(error),
			);

			// Return default configuration
			const defaultConfig = new MdnsConfigModel();
			defaultConfig.type = MDNS_MODULE_NAME;
			defaultConfig.serviceName = MDNS_DEFAULT_SERVICE_NAME;
			defaultConfig.serviceType = MDNS_DEFAULT_SERVICE_TYPE;

			return defaultConfig;
		}
	}

	/**
	 * Get the configured service name
	 */
	getServiceName(): string {
		const config = this.getConfig();

		return config.serviceName;
	}

	/**
	 * Get the configured service type
	 */
	getServiceType(): string {
		const config = this.getConfig();

		return config.serviceType;
	}

	/**
	 * Get backend version from package.json
	 */
	private getVersion(): string {
		try {
			const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8')) as
				| { version: string }
				| undefined;

			return pkgJson?.version ?? '0.0.0';
		} catch {
			this.logger.warn('Failed to read package.json, using default version');

			return '0.0.0';
		}
	}

	/**
	 * Supplies the HTTP port after Fastify has started listening. The managed
	 * service is deliberately registered only after this signal, so it never
	 * advertises an endpoint that is not accepting connections yet.
	 */
	setHttpServerReady(port: number): void {
		this.httpServerPort = port;
	}

	/**
	 * Register only after Fastify is listening. The service manager starts a
	 * late registration independently, so mDNS readiness cannot hold up the
	 * initial connector startup sequence.
	 */
	onHttpServerReady(port: number): void {
		this.setHttpServerReady(port);

		if (!this.managedServiceManager.isRegistered('module', MDNS_MODULE_NAME, this.serviceId)) {
			this.managedServiceManager.register(this);
		}
	}

	async start(): Promise<void> {
		await this.withLock(async () => {
			await Promise.resolve();

			if (this.state === 'started') {
				return;
			}

			if (this.httpServerPort === null) {
				throw new Error('Cannot start mDNS advertisement before the HTTP server is ready');
			}

			this.state = 'starting';

			try {
				this.logger.log('Starting mDNS service advertisement');

				// Create the Bonjour instance
				this.bonjour = new Bonjour();

				const baseServiceName = this.getServiceName();
				const serviceType = this.getServiceType();
				const version = this.getVersion();
				const host = hostname();

				// Include hostname in service name to ensure uniqueness on the network
				// e.g., "FastyBird Smart Panel (smart-panel-aio)"
				const serviceName = `${baseServiceName} (${host})`;

				// Create TXT record data
				const txtRecord: Record<string, string> = {
					version,
					api: `/${API_PREFIX}/v1`,
					secure: 'false',
					hostname: host,
				};

				// Publish the service
				this.service = this.bonjour.publish({
					name: serviceName,
					type: serviceType,
					protocol: MDNS_DEFAULT_PROTOCOL,
					port: this.httpServerPort,
					txt: txtRecord,
				});

				this.advertisedPort = this.httpServerPort;
				this.advertisedServiceName = baseServiceName;
				this.advertisedServiceType = serviceType;
				this.isAdvertising = true;
				this.state = 'started';

				this.logger.log(
					`Service advertised successfully: ${serviceName} (_${serviceType}._${MDNS_DEFAULT_PROTOCOL}) on port ${this.httpServerPort}`,
				);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to advertise service: ${err.message}`, err.stack);
				await this.cleanupFailedStart();
				this.state = 'error';
				throw error;
			}
		});
	}

	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped' && !this.isAdvertising) {
				return;
			}

			this.state = 'stopping';

			try {
				this.logger.log('Stopping mDNS service advertisement');

				if (this.bonjour) {
					// Wait for unpublishAll to complete before destroying the bonjour instance
					// This prevents race conditions where destroy() is called while unpublishing is in progress
					const bonjourInstance = this.bonjour;

					await new Promise<void>((resolve, reject) => {
						try {
							bonjourInstance.unpublishAll((error?: Error) => {
								if (error) {
									this.logger.warn(`Error during unpublishAll: ${error.message}`);
									// Continue with cleanup even if unpublishAll had an error
								}
								resolve();
							});
						} catch (err) {
							const error = err instanceof Error ? err : new Error(String(err));

							reject(error);
						}
					});

					this.bonjour.destroy();
					this.bonjour = null;
				}

				this.service = null;
				this.isAdvertising = false;
				this.advertisedPort = 0;
				this.advertisedServiceName = null;
				this.advertisedServiceType = null;
				this.state = 'stopped';

				this.logger.log('Service advertisement stopped successfully');
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to stop service advertisement: ${err.message}`, err.stack);
				this.state = 'error';
				throw error;
			}
		});
	}

	/**
	 * Get current service information
	 */
	getServiceInfo(): MdnsServiceInfo | null {
		if (!this.isAdvertising || !this.service) {
			return null;
		}

		return {
			name: this.getServiceName(),
			type: `_${this.getServiceType()}._${MDNS_DEFAULT_PROTOCOL}`,
			port: this.advertisedPort,
			hostname: hostname(),
			txt: {
				version: this.getVersion(),
				api: `/${API_PREFIX}/v1`,
				secure: 'false',
			},
		};
	}

	/**
	 * Check if service is currently advertising
	 */
	isCurrentlyAdvertising(): boolean {
		return this.isAdvertising;
	}

	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.state === 'started' && this.isAdvertising && this.service !== null);
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		const serviceName = this.getServiceName();
		const serviceType = this.getServiceType();

		return Promise.resolve({
			restartRequired:
				this.advertisedServiceName !== null &&
				this.advertisedServiceType !== null &&
				(this.advertisedServiceName !== serviceName || this.advertisedServiceType !== serviceType),
		});
	}

	/**
	 * Bonjour allocates its multicast socket during construction. A failed
	 * publish can therefore still leave an instance behind; release it before a
	 * managed-service retry replaces the reference with a new instance.
	 */
	private async cleanupFailedStart(): Promise<void> {
		const bonjourInstance = this.bonjour;

		this.bonjour = null;
		this.service = null;
		this.isAdvertising = false;
		this.advertisedPort = 0;
		this.advertisedServiceName = null;
		this.advertisedServiceType = null;

		if (!bonjourInstance) {
			return;
		}

		try {
			await new Promise<void>((resolve) => {
				try {
					bonjourInstance.unpublishAll(() => resolve());
				} catch (error) {
					this.logger.warn(
						`Failed to unpublish incomplete mDNS advertisement: ${error instanceof Error ? error.message : String(error)}`,
					);
					resolve();
				}
			});
		} finally {
			try {
				bonjourInstance.destroy();
			} catch (error) {
				this.logger.warn(
					`Failed to destroy incomplete mDNS advertisement: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	/**
	 * NestJS lifecycle hook - called when application is shutting down
	 */
	async onApplicationShutdown(signal?: string): Promise<void> {
		this.logger.log(`Application shutdown triggered (signal: ${signal ?? 'unknown'})`);

		await this.stop();
	}
}
