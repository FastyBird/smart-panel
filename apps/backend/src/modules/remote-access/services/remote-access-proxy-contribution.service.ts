import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { isValidTrustedProxyEntry } from '../../api/utils/ip-match.utils';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessConfigModel } from '../models/config.model';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { RemoteAccessStatusService } from './remote-access-status.service';

// Hard backstop on the rejected-proxy-entry warning set so a provider that
// keeps reporting a fresh malformed value on every poll can't grow it
// without limit.
const REJECTED_ENTRY_WARNING_MAX_ENTRIES = 500;

/**
 * Contributes this module's trusted-proxy addresses to the shared
 * `TrustedProxyRegistryService` (RA-1) so `ClientAddressService` resolves
 * the real client behind a tunnel or reverse proxy: the module config's
 * `trusted_proxies` when `trust_forwarded_headers` is on, plus every
 * `proxyAddresses` entry of a provider whose last cached status is
 * `connected`. `addresses()` is read live on every `isTrusted()` call, so a
 * config edit or a provider reconnecting with a new address needs no
 * re-registration here.
 *
 * A provider only ever proxies from a fixed local address, so each
 * `proxyAddresses` entry must be a bare loopback or single-host IPv4/IPv6
 * address, never a CIDR range — broad ranges are reserved for the
 * operator's own `trusted_proxies` (validated separately by
 * `IsTrustedProxyEntryConstraint` on the config DTO, not by this service).
 * Every provider-declared entry is checked with `isValidTrustedProxyEntry`
 * (`api/utils/ip-match.utils.ts`, the same parser
 * `TrustedProxyRegistryService.isTrusted()` matches against) and rejected if
 * it carries a `/` suffix; a rejected entry is dropped and logged once per
 * provider and value (see `warnRejectedEntry`), never on every
 * `isTrusted()` call.
 */
@Injectable()
export class RemoteAccessProxyContributionService implements OnModuleInit {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessProxyContributionService');

	// Bounded `"type value" -> warned` set so a rejected provider entry
	// is logged once instead of on every `computeAddresses()` call (read
	// live on every `isTrusted()` call — see class doc).
	// `REJECTED_ENTRY_WARNING_MAX_ENTRIES` is a hard backstop of last resort
	// against a provider that keeps generating fresh malformed values.
	private readonly warnedRejectedEntries = new Set<string>();

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
			if (status.state !== 'connected') {
				continue;
			}

			for (const entry of status.proxyAddresses) {
				if (this.isAcceptableProviderProxyEntry(entry)) {
					addresses.push(entry);
				} else {
					this.warnRejectedEntry(status.type, entry);
				}
			}
		}

		return addresses;
	}

	/**
	 * A provider may declare only a loopback or single-host address — a `/`
	 * suffix (even an explicit `/32` or `/128`) makes it a CIDR range and is
	 * rejected outright, since a provider proxies from one fixed local
	 * address and broad ranges belong only to the operator's own
	 * `trusted_proxies`.
	 */
	private isAcceptableProviderProxyEntry(entry: string): boolean {
		return isValidTrustedProxyEntry(entry) && !entry.includes('/');
	}

	private warnRejectedEntry(providerType: string, entry: string): void {
		const key = `${providerType} ${entry}`;

		if (this.warnedRejectedEntries.has(key)) {
			return;
		}

		if (this.warnedRejectedEntries.size >= REJECTED_ENTRY_WARNING_MAX_ENTRIES) {
			// Hard bound of last resort: unlike `ClientAddressService`'s
			// untrusted-peer warnings, there's no per-entry timestamp to prune
			// stale entries by first, so insertion order is the only signal
			// left to pick a victim. Iterate-and-break instead of
			// `.keys().next().value`, whose `IteratorResult` return type
			// widens to `any` under our strict ESLint rules.
			for (const oldestKey of this.warnedRejectedEntries) {
				this.warnedRejectedEntries.delete(oldestKey);
				break;
			}
		}

		this.warnedRejectedEntries.add(key);

		this.logger.warn(
			`Provider '${providerType}' declared an invalid proxy address '${entry}'; providers may declare only a loopback or single-host address, not a CIDR range. Dropping it from the trusted-proxy set.`,
		);
	}
}
