import { randomUUID } from 'crypto';

import { Injectable, Optional } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessProviderModel } from '../models/provider.model';
import {
	IRemoteAccessProvider,
	RemoteAccessAcceptedProviderStatus,
	RemoteAccessProviderSnapshot,
	RemoteAccessProviderStatus,
	RemoteAccessSnapshotVersion,
	RemoteAccessStatusReadOptions,
} from '../platforms/remote-access-provider.platform';
import {
	EventType,
	REMOTE_ACCESS_MODULE_NAME,
	REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS,
} from '../remote-access.constants';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';

import { RemoteAccessProviderRegistryService } from './remote-access-provider-registry.service';

class ProviderStatusTimeoutError extends Error {}

/** Publication payloads are plain data; freezing also protects later event listeners from earlier consumers. */
const freezeSnapshot = <T>(value: T): T => {
	if (value !== null && typeof value === 'object') {
		for (const nested of Object.values(value as Record<string, unknown>)) {
			freezeSnapshot(nested);
		}
		Object.freeze(value);
	}
	return value;
};

interface ProviderObservation {
	controller: AbortController;
	result: Promise<RemoteAccessAcceptedProviderStatus>;
}

/** Owns acceptance and ordering for every REST and websocket provider publication. */
@Injectable()
export class RemoteAccessStatusService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessStatusService');

	private readonly epoch = randomUUID();
	private revision = 0;
	private readonly cache = new Map<string, RemoteAccessAcceptedProviderStatus>();
	private readonly detailSnapshots = new Map<
		string,
		{ status: RemoteAccessAcceptedProviderStatus; metadata?: unknown; enabled: boolean }
	>();
	private readonly generations = new Map<string, number>();
	private readonly observations = new Map<string, ProviderObservation>();
	private readonly warnedTypeMismatches = new Set<string>();

	constructor(
		private readonly registry: RemoteAccessProviderRegistryService,
		private readonly configService: ConfigService,
		@Optional() private readonly eventEmitter?: EventEmitter2,
	) {}

	hasProvider(type: string): boolean {
		return this.registry.get(type) !== null;
	}

	getVersion(): RemoteAccessSnapshotVersion {
		this.getCachedStatuses();
		return { epoch: this.epoch, revision: this.revision };
	}

	/** Raw events are input only. Accepted publications use a separate event to avoid listener-order races. */
	@OnEvent(EventType.PROVIDER_OBSERVATION)
	onProviderStatus(observation: RemoteAccessProviderStatus | RemoteAccessProviderSnapshot): void {
		const { status, metadata } = 'status' in observation ? observation : { status: observation, metadata: undefined };
		const provider = this.registry.get(status.type);

		if (!provider) {
			this.logger.debug(
				`Ignoring a Provider.Status event for '${status.type}', which is not a registered provider type.`,
			);
			return;
		}

		this.invalidateObservation(provider.type);

		this.accept(provider, status, metadata);
	}

	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	onConfigUpdated(event: { source: string; type: 'module' | 'plugin' }): void {
		if (event.type === 'plugin' && this.hasProvider(event.source)) {
			this.invalidateObservation(event.source);
			const provider = this.registry.get(event.source);
			if (provider) {
				this.accept(provider, this.errorStatus(provider, 'Provider configuration changed; awaiting observation.'));
			}
		} else if (event.type === 'module' && event.source === REMOTE_ACCESS_MODULE_NAME) {
			// The module setting governs its registry outputs, not independently enabled provider lifecycle.
			this.revision++;
		}
	}

	getCachedStatuses(): RemoteAccessAcceptedProviderStatus[] {
		for (const type of this.cache.keys()) {
			if (!this.isProviderEnabled(type)) {
				this.invalidateObservation(type);
				const provider = this.registry.get(type);
				if (provider) {
					this.accept(provider, this.errorStatus(provider, 'Provider plugin is disabled.'));
				} else {
					this.prune(type);
				}
			}
		}
		return Array.from(this.cache.values());
	}

	getCachedProviderStatus(type: string): RemoteAccessAcceptedProviderStatus | undefined {
		this.getCachedStatuses();
		return this.cache.get(type);
	}

	/** Read after all asynchronous candidates/observations, so aggregate fields describe the same committed state. */
	getCachedProviderModels(): RemoteAccessProviderModel[] {
		this.getCachedStatuses();
		return this.registry.getAll().flatMap((provider) => {
			const status = this.cache.get(provider.type);
			return status ? [this.toModel(provider, status)] : [];
		});
	}

	async getAggregatedStatuses(options: RemoteAccessStatusReadOptions = {}): Promise<RemoteAccessProviderModel[]> {
		const enabled = this.registry.getAll().filter((provider) => this.isProviderEnabled(provider.type));
		await Promise.all(enabled.map((provider) => this.pollProvider(provider, options)));
		return this.getCachedProviderModels();
	}

	async getProviderStatus(
		type: string,
		options: RemoteAccessStatusReadOptions = {},
	): Promise<RemoteAccessProviderModel> {
		const provider = this.registry.get(type);
		if (!provider) {
			throw new RemoteAccessProviderNotFoundException(`Remote access provider '${type}' is not registered.`);
		}
		return this.pollProvider(provider, options);
	}

	getCachedProviderSnapshot<T = unknown>(
		type: string,
	): { status: RemoteAccessProviderModel; metadata?: T } | undefined {
		const provider = this.registry.get(type);
		let snapshot = this.detailSnapshots.get(type);
		if (provider && snapshot?.enabled && !this.isProviderEnabled(type)) {
			this.invalidateObservation(type);
			this.accept(provider, this.errorStatus(provider, 'Provider plugin is disabled.'));
			snapshot = this.detailSnapshots.get(type);
		}
		if (!provider || !snapshot) {
			return undefined;
		}
		return {
			status: this.toModel(provider, snapshot.status),
			metadata: structuredClone(snapshot.metadata) as T | undefined,
		};
	}

	async getProviderSnapshot<T = unknown>(
		type: string,
		options: RemoteAccessStatusReadOptions = {},
	): Promise<{ status: RemoteAccessProviderModel; metadata?: T }> {
		const provider = this.registry.get(type);
		if (!provider) {
			throw new RemoteAccessProviderNotFoundException(`Remote access provider '${type}' is not registered.`);
		}
		const observation = this.observations.get(type) ?? this.observe(provider, options);
		const result = await observation.result;
		return this.getCachedProviderSnapshot<T>(type) ?? { status: this.toModel(provider, result) };
	}

	private isProviderEnabled(type: string): boolean {
		try {
			return this.configService.getPluginConfig(type).enabled === true;
		} catch {
			return false;
		}
	}

	private async pollProvider(
		provider: IRemoteAccessProvider,
		options: RemoteAccessStatusReadOptions,
	): Promise<RemoteAccessProviderModel> {
		if (!this.isProviderEnabled(provider.type)) {
			this.invalidateObservation(provider.type);
			this.prune(provider.type);
			return this.toModel(provider, {
				...this.errorStatus(provider, 'Provider plugin is disabled.'),
				enabled: false,
				...this.getVersion(),
			});
		}

		const observation = this.observations.get(provider.type) ?? this.observe(provider, options);
		const result = await observation.result;
		// A second provider may have completed or a newer event may have arrived while this caller awaited.
		return this.toModel(provider, this.getCachedProviderStatus(provider.type) ?? result);
	}

	private observe(provider: IRemoteAccessProvider, options: RemoteAccessStatusReadOptions): ProviderObservation {
		const generation = this.generations.get(provider.type) ?? 0;
		const controller = new AbortController();
		let expired = false;
		let timer: ReturnType<typeof setTimeout>;
		let work: Promise<RemoteAccessProviderSnapshot>;
		try {
			const readOptions = { fresh: options.fresh, signal: controller.signal };
			work = provider.getSnapshot
				? provider.getSnapshot(readOptions)
				: provider.getStatus(readOptions).then((status) => ({ status }));
		} catch (error) {
			work = Promise.reject(error instanceof Error ? error : new Error('Provider observation failed.'));
		}
		const deadline = new Promise<RemoteAccessProviderSnapshot>((_resolve, reject) => {
			timer = setTimeout(() => {
				expired = true;
				reject(new ProviderStatusTimeoutError());
				controller.abort();
			}, REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS);
		});

		const result = Promise.race([work, deadline])
			.catch((error: unknown): RemoteAccessProviderSnapshot => {
				const message =
					error instanceof ProviderStatusTimeoutError
						? `Provider did not report a status within ${REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS}ms.`
						: 'Failed to retrieve status from this provider.';
				this.logger.error(`Failed to retrieve status from provider '${provider.type}'`, { message });
				return { status: this.errorStatus(provider, message) };
			})
			.then(({ status, metadata }) => {
				clearTimeout(timer);
				if (generation !== (this.generations.get(provider.type) ?? 0)) {
					return (
						this.detailSnapshots.get(provider.type)?.status ?? {
							...this.errorStatus(provider, 'Provider observation was superseded.'),
							enabled: this.isProviderEnabled(provider.type),
							...this.getVersion(),
						}
					);
				}
				return this.accept(provider, status, metadata);
			});

		const observation = { controller, result };
		this.observations.set(provider.type, observation);
		// Release only after the actual provider work settles. A provider ignoring abort cannot accumulate calls.
		let workSettled = false;
		let resultSettled = false;
		const release = (): void => {
			if (workSettled && resultSettled && this.observations.get(provider.type) === observation) {
				this.observations.delete(provider.type);
			}
		};
		const settleWork = (): void => {
			workSettled = true;
			if (!expired) {
				clearTimeout(timer);
			}
			release();
		};
		const settleResult = (): void => {
			resultSettled = true;
			release();
		};
		void work.then(settleWork, settleWork);
		void result.then(settleResult, settleResult);
		return observation;
	}

	private invalidateObservation(type: string): void {
		this.generations.set(type, (this.generations.get(type) ?? 0) + 1);
		this.observations.get(type)?.controller.abort();
	}

	private prune(type: string): void {
		if (this.cache.delete(type)) {
			this.revision++;
		}
	}

	private accept(
		provider: IRemoteAccessProvider,
		status: RemoteAccessProviderStatus,
		metadata?: unknown,
	): RemoteAccessAcceptedProviderStatus {
		const enabled = this.isProviderEnabled(provider.type);
		const accepted = freezeSnapshot(
			structuredClone({
				...this.normalizeStatusType(provider, status),
				...(!enabled ? { state: 'disconnected' as const, endpoints: [], proxyAddresses: [] } : {}),
				enabled,
				epoch: this.epoch,
				revision: ++this.revision,
			}),
		);
		this.detailSnapshots.set(provider.type, {
			status: accepted,
			metadata: freezeSnapshot(structuredClone(metadata)),
			enabled,
		});
		if (enabled) {
			this.cache.set(provider.type, accepted);
		} else {
			this.cache.delete(provider.type);
		}
		this.eventEmitter?.emit(EventType.PROVIDER_STATUS, accepted);
		return accepted;
	}

	private toModel(
		provider: IRemoteAccessProvider,
		status: RemoteAccessAcceptedProviderStatus,
	): RemoteAccessProviderModel {
		return toInstance(RemoteAccessProviderModel, {
			...status,
			kind: provider.kind,
			capabilities: provider.capabilities,
		});
	}

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

	private errorStatus(provider: IRemoteAccessProvider, message: string): RemoteAccessProviderStatus {
		return {
			type: provider.type,
			state: 'error',
			endpoints: [],
			message,
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: new Date().toISOString(),
		};
	}
}
