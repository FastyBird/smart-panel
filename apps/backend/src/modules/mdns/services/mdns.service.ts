import { Bonjour, Service } from 'bonjour-service';
import { readFileSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { API_PREFIX } from '../../../app.constants';
import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
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
export class MdnsService implements OnApplicationShutdown {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(MDNS_MODULE_NAME, 'MdnsService');
	private bonjour: Bonjour | null = null;
	private service: Service | null = null;
	private isAdvertising = false;
	private advertisedPort: number = 0;

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Get mDNS configuration from app config
	 */
	private getConfig(): MdnsConfigModel {
		try {
			return this.configService.getModuleConfig<MdnsConfigModel>(MDNS_MODULE_NAME);
		} catch (error) {
			this.logger.warn('Failed to load mDNS configuration, using defaults', error);

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
	 * Start advertising the backend service via mDNS
	 */
	advertise(port: number): void {
		if (this.isAdvertising) {
			this.logger.warn('Service is already being advertised');

			return;
		}

		try {
			this.logger.log('Starting mDNS service advertisement');

			// Create the Bonjour instance
			this.bonjour = new Bonjour();

			const serviceName = this.getServiceName();
			const serviceType = this.getServiceType();
			const version = this.getVersion();
			const host = hostname();

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
				port,
				txt: txtRecord,
			});

			this.advertisedPort = port;
			this.isAdvertising = true;

			this.logger.log(
				`Service advertised successfully: ${serviceName} (_${serviceType}._${MDNS_DEFAULT_PROTOCOL}) on port ${port}`,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to advertise service: ${err.message}`, err.stack);

			// Don't throw - mDNS failure should not prevent app from starting
		}
	}

	/**
	 * Stop advertising and clean up mDNS resources
	 */
	async stopAdvertising(): Promise<void> {
		if (!this.isAdvertising) {
			return;
		}

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

			this.logger.log('Service advertisement stopped successfully');
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to stop service advertisement: ${err.message}`, err.stack);
		}
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

	/**
	 * NestJS lifecycle hook - called when application is shutting down
	 */
	async onApplicationShutdown(signal?: string): Promise<void> {
		this.logger.log(`Application shutdown triggered (signal: ${signal ?? 'unknown'})`);

		await this.stopAdvertising();
	}
}
