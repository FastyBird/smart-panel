import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { isValidTrustedProxyEntry } from '../../api/utils/ip-match.utils';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessConfigModel } from '../models/config.model';
import {
	EventType,
	REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS,
	REMOTE_ACCESS_MODULE_NAME,
} from '../remote-access.constants';

import { RemoteAccessStatusService } from './remote-access-status.service';

// Hard backstop on the rejected-proxy-entry warning set so a provider that
// keeps reporting a fresh malformed value on every poll can't grow it
// without limit.
const REJECTED_ENTRY_WARNING_MAX_ENTRIES = 500;

interface ConfigUpdatedEvent {
	source: string;
	type: 'module' | 'plugin';
}

/**
 * Contributes this module's trusted-proxy addresses to the shared
 * `TrustedProxyRegistryService` (RA-1) so `ClientAddressService` resolves
 * the real client behind a tunnel or reverse proxy: the module config's
 * `trusted_proxies` when `trust_forwarded_headers` is on, plus every
 * `proxyAddresses` entry of a provider whose last cached status is
 * `connected`.
 *
 * `addresses()` is called by `TrustedProxyRegistryService.isTrusted()` on
 * every HTTP/websocket request (via `DisplayAwareThrottlerGuard` and
 * friends), so it stays synchronous and cheap: the computed list is
 * memoised and only recomputed on `ConfigEventType.CONFIG_UPDATED` (for this
 * module) and `EventType.PROVIDER_STATUS`, mirroring how
 * `RemoteAccessUrlService.refresh()` subscribes to the same two events. A
 * config read that throws (`ConfigNotFoundException`/`ConfigCorruptedException`,
 * including `validateSync` failures) is caught and contributes `[]` — fail
 * closed, trust nothing — logging a warning once per distinct failure
 * message rather than on every recompute.
 *
 * A failed read is deliberately **not** memoised the same way a valid empty
 * result is: recovery must not depend entirely on a `CONFIG_UPDATED`/
 * `PROVIDER_STATUS` event happening to arrive while the config store is
 * broken. Instead, a failure records when it happened, and the next
 * `addresses()` call once `REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS` has
 * passed retries the read on its own — still returning the memoised `[]`
 * (fail closed) for every call in between. A successful read (whether the
 * first one, an event-triggered one, or a timed retry) clears the failure
 * state and resumes normal event-only invalidation.
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
 * provider and value (see `warnRejectedEntry`), never on every recompute.
 */
@Injectable()
export class RemoteAccessProxyContributionService implements OnModuleInit {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessProxyContributionService');

	// Bounded `JSON.stringify([type, value]) -> warned` set so a rejected
	// provider entry is logged once instead of on every recompute.
	// JSON-encoding the pair, rather than joining it with a plain separator,
	// keeps ('a b', 'c') and ('a', 'b c') distinct so one provider's
	// rejection can't suppress another's warning.
	// `REJECTED_ENTRY_WARNING_MAX_ENTRIES` is a hard backstop of last
	// resort against a provider that keeps generating fresh malformed
	// values.
	private readonly warnedRejectedEntries = new Set<string>();

	// Memoised result of the last recompute, invalidated by the two events
	// above; `null` means "no computation cached yet" (also the state right
	// after an invalidating event).
	private cachedAddresses: string[] | null = null;

	// Last config-read failure message that was actually logged, so a config
	// that stays broken across many requests warns once instead of on every
	// recompute; reset on a successful read so the same failure recurring
	// later (e.g. after a config edit reintroduces it) warns again.
	private lastConfigErrorMessage: string | null = null;

	// `Date.now()` of the last failed config read, or `null` when the most
	// recent read (if any) succeeded. Distinguishes a fail-closed `[]` in
	// `cachedAddresses` from a genuinely empty, valid result: only the
	// former is eligible for a timed retry (see `computeAddresses()`) —
	// event-driven invalidation applies to both alike.
	private configReadFailedAt: number | null = null;

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

	@OnEvent(EventType.PROVIDER_STATUS)
	onProviderStatus(): void {
		this.invalidate();
	}

	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	onConfigUpdated(event: ConfigUpdatedEvent): void {
		if (event.type !== 'module' || event.source !== REMOTE_ACCESS_MODULE_NAME) {
			return;
		}

		this.invalidate();
	}

	private invalidate(): void {
		this.cachedAddresses = null;
	}

	private computeAddresses(): string[] {
		if (this.cachedAddresses === null || this.isFailedReadDueForRetry()) {
			this.cachedAddresses = this.recomputeAddresses();
		}

		return this.cachedAddresses;
	}

	/**
	 * `cachedAddresses` alone can't distinguish a fail-closed `[]` from a
	 * genuinely empty valid result — `configReadFailedAt` is only set on the
	 * former (see `recomputeAddresses()`), so only that state is ever
	 * eligible for a retry here; a valid empty result stays memoised until
	 * an invalidating event, exactly as before.
	 */
	private isFailedReadDueForRetry(): boolean {
		return (
			this.configReadFailedAt !== null &&
			Date.now() - this.configReadFailedAt >= REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS
		);
	}

	private recomputeAddresses(): string[] {
		let config: RemoteAccessConfigModel;

		try {
			config = this.configService.getModuleConfig<RemoteAccessConfigModel>(REMOTE_ACCESS_MODULE_NAME);
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown remote-access module config read error');

			// Logged once per distinct failure message, not once per recompute
			// (let alone once per request) — a config that stays broken across
			// many requests would otherwise spam the log every time the cache
			// is invalidated and read again.
			if (this.lastConfigErrorMessage !== err.message) {
				this.lastConfigErrorMessage = err.message;

				this.logger.warn(
					`Failed to read the remote-access module config while computing trusted proxies; contributing no addresses (fail closed) until it recovers. error=${err.message}`,
				);
			}

			// Marks this `[]` as fail-closed, not a settled memo — the next
			// call past the retry interval tries the read again on its own,
			// instead of waiting indefinitely for an invalidating event.
			this.configReadFailedAt = Date.now();

			return [];
		}

		this.lastConfigErrorMessage = null;
		this.configReadFailedAt = null;

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
		// JSON-encode the pair instead of joining with a plain separator so
		// two distinct pairs can never collide onto the same key.
		const key = JSON.stringify([providerType, entry]);

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
