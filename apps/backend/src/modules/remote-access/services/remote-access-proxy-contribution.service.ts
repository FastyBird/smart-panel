import { Injectable, OnModuleInit } from '@nestjs/common';

import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessConfigModel } from '../models/config.model';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { RemoteAccessStatusService } from './remote-access-status.service';

/**
 * Contributes this module's trusted-proxy addresses to the shared
 * `TrustedProxyRegistryService` (RA-1) so `ClientAddressService` resolves
 * the real client behind a tunnel or reverse proxy: the module config's
 * `trusted_proxies` when `trust_forwarded_headers` is on, plus every
 * `proxyAddresses` entry of a provider whose last cached status is
 * `connected`. `addresses()` is read live on every `isTrusted()` call, so a
 * config edit or a provider reconnecting with a new address needs no
 * re-registration here.
 */
@Injectable()
export class RemoteAccessProxyContributionService implements OnModuleInit {
	constructor(
		private readonly trustedProxyRegistry: TrustedProxyRegistryService,
		private readonly configService: ConfigService,
		private readonly statusService: RemoteAccessStatusService,
	) {}

	onModuleInit(): void {
		this.trustedProxyRegistry.register({
			id: REMOTE_ACCESS_MODULE_NAME,
			addresses: () => this.computeAddresses(),
		});
	}

	private computeAddresses(): string[] {
		const config = this.configService.getModuleConfig<RemoteAccessConfigModel>(REMOTE_ACCESS_MODULE_NAME);

		// Disabled: providers stop, only the internal URL resolves — this
		// module contributes no trusted proxies at all, regardless of what
		// trust_forwarded_headers/trusted_proxies still say or whether a
		// provider hasn't caught up to being disabled yet.
		if (!config.enabled) {
			return [];
		}

		const addresses: string[] = [];

		if (config.trustForwardedHeaders) {
			addresses.push(...config.trustedProxies);
		}

		for (const status of this.statusService.getCachedStatuses()) {
			if (status.state === 'connected') {
				addresses.push(...status.proxyAddresses);
			}
		}

		return addresses;
	}
}
