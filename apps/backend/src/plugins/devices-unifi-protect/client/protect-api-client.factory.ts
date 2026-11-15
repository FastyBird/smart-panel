import { Inject, Injectable, Optional } from '@nestjs/common';

import { PROTECT_TRUSTED_CA } from '../devices-unifi-protect.constants';

import { ProtectApiClient, ProtectApiClientOptions } from './protect-api.client';

export const PROTECT_API_CLIENT_FACTORY = Symbol('PROTECT_API_CLIENT_FACTORY');

export interface ProtectApiClientFactory {
	create(options: Omit<ProtectApiClientOptions, 'trustedCa' | 'transport'>): ProtectApiClient;
}

/** Builds one client, with its own TLS agent and rate pacer, per console connection. */
@Injectable()
export class DefaultProtectApiClientFactory implements ProtectApiClientFactory {
	constructor(@Optional() @Inject(PROTECT_TRUSTED_CA) private readonly trustedCa?: string) {}

	create(options: Omit<ProtectApiClientOptions, 'trustedCa' | 'transport'>): ProtectApiClient {
		return new ProtectApiClient({ ...options, trustedCa: this.trustedCa });
	}
}
