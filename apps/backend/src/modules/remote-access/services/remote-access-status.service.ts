import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { RemoteAccessProviderModel } from '../models/provider.model';
import { IRemoteAccessProvider, RemoteAccessProviderStatus } from '../platforms/remote-access-provider.platform';
import { EventType, REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';

import { RemoteAccessProviderRegistryService } from './remote-access-provider-registry.service';

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

	constructor(private readonly registry: RemoteAccessProviderRegistryService) {}

	@OnEvent(EventType.PROVIDER_STATUS)
	onProviderStatus(status: RemoteAccessProviderStatus): void {
		this.cache.set(status.type, status);
	}

	/** Synchronous, cache-only read of the last known status per provider. */
	getCachedStatuses(): RemoteAccessProviderStatus[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Live poll of every registered provider, merged with its static kind and
	 * capabilities. Updates the cache as a side effect so reactive consumers
	 * see this fresh data too. A provider whose `getStatus()` rejects gets a
	 * synthesized `error` entry instead of failing the whole aggregate.
	 */
	async getAggregatedStatuses(): Promise<RemoteAccessProviderModel[]> {
		return Promise.all(this.registry.getAll().map((provider) => this.pollProvider(provider)));
	}

	/** Live poll of a single provider by type; throws when the type is unknown. */
	async getProviderStatus(type: string): Promise<RemoteAccessProviderModel> {
		const provider = this.registry.get(type);

		if (!provider) {
			throw new RemoteAccessProviderNotFoundException(`Remote access provider '${type}' is not registered.`);
		}

		return this.pollProvider(provider);
	}

	private async pollProvider(provider: IRemoteAccessProvider): Promise<RemoteAccessProviderModel> {
		const status = await this.fetchStatus(provider);

		this.cache.set(status.type, status);

		return toInstance(RemoteAccessProviderModel, {
			...status,
			kind: provider.kind,
			capabilities: provider.capabilities,
		});
	}

	private async fetchStatus(provider: IRemoteAccessProvider): Promise<RemoteAccessProviderStatus> {
		try {
			return await provider.getStatus();
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown remote access provider status error');

			this.logger.error(`Failed to retrieve status from provider '${provider.type}'`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				type: provider.type,
				state: 'error',
				endpoints: [],
				message: 'Failed to retrieve status from this provider.',
				details: {},
				proxyAddresses: [],
				advisories: [],
				updatedAt: new Date().toISOString(),
			};
		}
	}
}
