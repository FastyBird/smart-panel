import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessProviderModel } from '../models/provider.model';
import { IRemoteAccessProvider, RemoteAccessProviderStatus } from '../platforms/remote-access-provider.platform';
import {
	EventType,
	REMOTE_ACCESS_MODULE_NAME,
	REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS,
} from '../remote-access.constants';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';

import { RemoteAccessProviderRegistryService } from './remote-access-provider-registry.service';

/** Marks a rejection produced by the deadline race in `fetchStatus()`, not by the provider itself. */
class ProviderStatusTimeoutError extends Error {}

/**
 * Aggregates provider statuses on demand (`getAggregatedStatuses`,
 * `getProviderStatus` — live `getStatus()` calls, used by the REST surface)
 * and caches the last status per provider from the
 * `RemoteAccessModule.Provider.Status` bus event (`getCachedStatuses` — a
 * synchronous read, used by `RemoteAccessUrlService`,
 * `RemoteAccessPostureService` and `RemoteAccessProxyContributionService`,
 * none of which can await a live call from a per-request code path).
 */
@Injectable()
export class RemoteAccessStatusService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessStatusService');

	private readonly cache = new Map<string, RemoteAccessProviderStatus>();

	// `pollProvider()` mismatches are rare (a provider bug), but polled
	// repeatedly (every /status or /providers request); track which
	// provider types already warned so a misbehaving provider doesn't spam
	// the log once per request.
	private readonly warnedTypeMismatches = new Set<string>();

	constructor(
		private readonly registry: RemoteAccessProviderRegistryService,
		private readonly configService: ConfigService,
	) {}

	/** Whether a provider of this type is registered, whatever its plugin's enabled state. */
	hasProvider(type: string): boolean {
		return this.registry.get(type) !== null;
	}

	/**
	 * Applies the same registered-type normalisation `pollProvider()` uses,
	 * so a mismatched-type event can never plant a phantom cache entry under
	 * an unregistered type — `getCachedStatuses()` feeds
	 * `RemoteAccessUrlService`/`RemoteAccessPostureService`/
	 * `RemoteAccessProxyContributionService` directly, so an unattributable
	 * entry would otherwise leak a URL/proxy address/advisory nothing
	 * actually vouches for. An event whose `type` does not resolve to a
	 * registered provider (there is no sender identity to fall back on
	 * here, unlike `pollProvider()`) is dropped and debug-logged instead of
	 * cached.
	 */
	@OnEvent(EventType.PROVIDER_STATUS)
	onProviderStatus(status: RemoteAccessProviderStatus): void {
		const provider = this.registry.get(status.type);

		if (!provider) {
			this.logger.debug(
				`Ignoring a Provider.Status event for '${status.type}', which is not a registered provider type.`,
			);

			return;
		}

		if (!this.isProviderEnabled(provider.type)) {
			this.cache.delete(provider.type);

			this.logger.debug(`Ignoring a Provider.Status event for '${provider.type}', whose plugin is disabled.`);

			return;
		}

		this.cache.set(provider.type, this.normalizeStatusType(provider, status));
	}

	/**
	 * Synchronous, cache-only read of the last known status per provider.
	 * A plugin the owner disables must vanish from the module at once — its
	 * endpoints, proxy addresses and advisories included — so providers whose
	 * plugin has been disabled since they were cached are pruned here, at
	 * read time, rather than through one more `CONFIG_UPDATED` listener.
	 */
	getCachedStatuses(): RemoteAccessProviderStatus[] {
		for (const type of Array.from(this.cache.keys())) {
			if (!this.isProviderEnabled(type)) {
				this.cache.delete(type);
			}
		}

		return Array.from(this.cache.values());
	}

	/**
	 * Live poll of every registered provider, merged with its static kind and
	 * capabilities. Updates the cache as a side effect so reactive consumers
	 * see this fresh data too. A provider whose `getStatus()` rejects gets a
	 * synthesized `error` entry instead of failing the whole aggregate.
	 */
	async getAggregatedStatuses(): Promise<RemoteAccessProviderModel[]> {
		const enabledProviders = this.registry.getAll().filter((provider) => {
			if (this.isProviderEnabled(provider.type)) {
				return true;
			}

			this.cache.delete(provider.type);

			return false;
		});

		const statuses = await Promise.all(enabledProviders.map((provider) => this.pollProvider(provider)));

		// A plugin can be disabled while its poll is still in flight; `pollProvider()` no longer caches
		// such a status, and it must not be listed either.
		return statuses.filter((status) => this.isProviderEnabled(status.type));
	}

	/** Live poll of a single provider by type; throws when the type is unknown. */
	async getProviderStatus(type: string): Promise<RemoteAccessProviderModel> {
		const provider = this.registry.get(type);

		if (!provider) {
			throw new RemoteAccessProviderNotFoundException(`Remote access provider '${type}' is not registered.`);
		}

		return this.pollProvider(provider);
	}

	/**
	 * A provider takes part in the module only while its owning plugin is
	 * enabled: disabled plugins are hidden from the app, so they are neither
	 * polled nor listed, and contribute no URLs, proxy addresses or
	 * advisories. A plugin whose config cannot be read counts as disabled.
	 */
	private isProviderEnabled(type: string): boolean {
		try {
			return this.configService.getPluginConfig(type).enabled === true;
		} catch {
			return false;
		}
	}

	private async pollProvider(provider: IRemoteAccessProvider): Promise<RemoteAccessProviderModel> {
		const status = this.normalizeStatusType(provider, await this.fetchStatus(provider));

		// Re-checked after the await: a plugin disabled mid-poll must not be written into the cache.
		if (this.isProviderEnabled(provider.type)) {
			this.cache.set(provider.type, status);
		}

		return toInstance(RemoteAccessProviderModel, {
			...status,
			kind: provider.kind,
			capabilities: provider.capabilities,
		});
	}

	/**
	 * The registered provider (looked up by its own `type`) is the
	 * authoritative identity, not whatever `status.type` the provider's
	 * `getStatus()` payload happens to claim: caching or returning the
	 * status under a mismatched type would key the cache wrong and return a
	 * `GET /providers/:type` response whose body disagrees with the URL.
	 */
	private normalizeStatusType(
		provider: IRemoteAccessProvider,
		status: RemoteAccessProviderStatus,
	): RemoteAccessProviderStatus {
		if (status.type === provider.type) {
			return status;
		}

		if (!this.warnedTypeMismatches.has(provider.type)) {
			this.warnedTypeMismatches.add(provider.type);

			this.logger.warn(
				`Provider '${provider.type}' reported a status with a different type ('${status.type}'); using the registered type.`,
			);
		}

		return { ...status, type: provider.type };
	}

	private async fetchStatus(provider: IRemoteAccessProvider): Promise<RemoteAccessProviderStatus> {
		try {
			return await this.raceWithTimeout(provider);
		} catch (error) {
			const timedOut = error instanceof ProviderStatusTimeoutError;
			const err = error instanceof Error ? error : new Error('Unknown remote access provider status error');

			this.logger.error(`Failed to retrieve status from provider '${provider.type}'`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				type: provider.type,
				state: 'error',
				endpoints: [],
				message: timedOut
					? `Provider did not report a status within ${REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS}ms.`
					: 'Failed to retrieve status from this provider.',
				details: {},
				proxyAddresses: [],
				advisories: [],
				updatedAt: new Date().toISOString(),
			};
		}
	}

	/**
	 * Races `provider.getStatus()` against a deadline so one provider that
	 * never settles cannot hang `getAggregatedStatuses()`'s `Promise.all`
	 * forever. This is a race, not a cancellation: the provider contract has
	 * no abort signal (providers already bound their own CLI calls), so a
	 * timed-out call keeps running in the background; its eventual
	 * settlement is simply ignored here.
	 */
	private raceWithTimeout(provider: IRemoteAccessProvider): Promise<RemoteAccessProviderStatus> {
		return new Promise<RemoteAccessProviderStatus>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(
					new ProviderStatusTimeoutError(
						`Provider '${provider.type}' did not report a status within ${REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS}ms.`,
					),
				);
			}, REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS);

			provider.getStatus().then(
				(status) => {
					clearTimeout(timer);
					resolve(status);
				},
				(error: unknown) => {
					clearTimeout(timer);
					reject(error as Error);
				},
			);
		});
	}
}
