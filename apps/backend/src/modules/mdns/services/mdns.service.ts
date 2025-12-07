import { Bonjour, Service } from 'bonjour-service';
import { readFileSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { API_PREFIX } from '../../../app.constants';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	MDNS_DEFAULT_PROTOCOL,
	MDNS_DEFAULT_SERVICE_NAME,
	MDNS_DEFAULT_SERVICE_TYPE,
	MDNS_ENV_ENABLED,
	MDNS_ENV_SERVICE_NAME,
	MDNS_ENV_SERVICE_TYPE,
} from '../mdns.constants';

export interface MdnsServiceInfo {
	name: string;
	type: string;
	port: number;
	hostname: string;
	txt: Record<string, string>;
}

@Injectable()
export class MdnsService implements OnApplicationShutdown {
	private readonly logger = new Logger(MdnsService.name);
	private bonjour: Bonjour | null = null;
	private service: Service | null = null;
	private isAdvertising = false;
	private advertisedPort: number = 0;

	constructor(private readonly configService: NestConfigService) {}

	/**
	 * Check if mDNS is enabled via environment configuration
	 */
	isEnabled(): boolean {
		const enabled = getEnvValue<string>(this.configService, MDNS_ENV_ENABLED, 'true');

		return enabled.toLowerCase() === 'true' || enabled === '1';
	}

	/**
	 * Get the configured service name
	 */
	getServiceName(): string {
		return getEnvValue<string>(this.configService, MDNS_ENV_SERVICE_NAME, MDNS_DEFAULT_SERVICE_NAME);
	}

	/**
	 * Get the configured service type
	 */
	getServiceType(): string {
		return getEnvValue<string>(this.configService, MDNS_ENV_SERVICE_TYPE, MDNS_DEFAULT_SERVICE_TYPE);
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
			this.logger.warn('[VERSION] Failed to read package.json, using default version');

			return '0.0.0';
		}
	}

	/**
	 * Start advertising the backend service via mDNS
	 */
	advertise(port: number): void {
		if (!this.isEnabled()) {
			this.logger.log('[MDNS] mDNS advertising is disabled via configuration');

			return;
		}

		if (this.isAdvertising) {
			this.logger.warn('[MDNS] Service is already being advertised');

			return;
		}

		try {
			this.logger.log('[MDNS] Starting mDNS service advertisement');

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
				`[MDNS] Service advertised successfully: ${serviceName} (_${serviceType}._${MDNS_DEFAULT_PROTOCOL}) on port ${port}`,
			);
			this.logger.debug(`[MDNS] TXT records: ${JSON.stringify(txtRecord)}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[MDNS] Failed to advertise service: ${err.message}`, err.stack);

			// Don't throw - mDNS failure should not prevent app from starting
		}
	}

	/**
	 * Stop advertising and clean up mDNS resources
	 */
	stopAdvertising(): void {
		if (!this.isAdvertising) {
			return;
		}

		try {
			this.logger.log('[MDNS] Stopping mDNS service advertisement');

			if (this.bonjour) {
				// unpublishAll will stop all published services and destroy the bonjour instance
				this.bonjour.unpublishAll(() => {
					this.logger.debug('[MDNS] All services unpublished');
				});

				this.bonjour.destroy();
				this.bonjour = null;
			}

			this.service = null;
			this.isAdvertising = false;
			this.advertisedPort = 0;

			this.logger.log('[MDNS] Service advertisement stopped successfully');
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[MDNS] Failed to stop service advertisement: ${err.message}`, err.stack);
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
	onApplicationShutdown(signal?: string): void {
		this.logger.log(`[MDNS] Application shutdown triggered (signal: ${signal ?? 'unknown'})`);

		this.stopAdvertising();
	}
}
