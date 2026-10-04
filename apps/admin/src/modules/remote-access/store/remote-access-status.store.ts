import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, snakeToCamel, useBackend, useLogger } from '../../../common';
import type { RemoteAccessModuleGetStatusOperation } from '../../../openapi.constants';
import { EventType, REMOTE_ACCESS_MODULE_PREFIX } from '../remote-access.constants';
import { RemoteAccessApiException, RemoteAccessValidationException } from '../remote-access.exceptions';

import {
	RemoteAccessProviderStatusEventSchema,
	RemoteAccessStatusSchema,
	RemoteAccessUrlsChangedEventSchema,
} from './remote-access-status.store.schemas';
import type {
	IRemoteAccessStatus,
	IRemoteAccessStatusOnEventActionPayload,
	IRemoteAccessStatusSetActionPayload,
	IRemoteAccessStatusStateSemaphore,
	IRemoteAccessStatusStoreActions,
	IRemoteAccessStatusStoreState,
	RemoteAccessStatusStoreSetup,
} from './remote-access-status.store.types';
import {
	applyRemoteAccessProviderStatusEvent,
	applyRemoteAccessUrlsChangedEvent,
	transformRemoteAccessStatusResponse,
} from './remote-access-status.transformers';
import { type SnapshotRequest, createSnapshotOrder } from './snapshot-order';

// A factory, not a shared constant: `ref()` wraps an object argument in a reactive proxy keyed by
// that object's identity, so every `useRemoteAccessStatus(pinia)` setup call must pass its own
// fresh object - reusing one module-level instance would make every store share the same
// reactive semaphore, and one store's in-flight `get()` would make every other store's `get()`
// throw "Already getting remote access status.".
const createDefaultSemaphore = (): IRemoteAccessStatusStateSemaphore => ({
	getting: false,
});

export const useRemoteAccessStatus = defineStore<'remote_access_module-status', RemoteAccessStatusStoreSetup>(
	'remote_access_module-status',
	(): RemoteAccessStatusStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IRemoteAccessStatusStateSemaphore>(createDefaultSemaphore());

		const firstLoad = ref<boolean>(false);

		const data = ref<IRemoteAccessStatus | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IRemoteAccessStatus> | null = null;

		const order = createSnapshotOrder();
		let getController: AbortController | null = null;
		let resynchronizing = false;
		const providerMetadata = new Map<string, IRemoteAccessStatus['providers'][number]>();

		const applyEvent = (event: string, payload: Record<string, unknown>): void => {
			if (data.value === null) return;
			if (event === EventType.PROVIDER_STATUS) {
				const type = String(payload.type);
				if (payload.enabled === false) {
					data.value = {
						...data.value,
						providers: data.value.providers.filter((provider) => provider.type !== type),
						advisories: data.value.advisories.filter((advisory) => advisory.provider !== type),
					};
					return;
				}
				if (!data.value.providers.some((provider) => provider.type === type)) {
					const metadata = providerMetadata.get(type);
					if (metadata) data.value = { ...data.value, providers: [...data.value.providers, metadata] };
				}
				data.value = applyRemoteAccessProviderStatusEvent(data.value, payload);
			} else data.value = applyRemoteAccessUrlsChangedEvent(data.value, payload);
		};
		const acceptStatus = (incoming: IRemoteAccessStatus, ticket?: SnapshotRequest): IRemoteAccessStatus => {
			if (order.establish(incoming, ticket)) {
				const current = data.value;
				for (const provider of incoming.providers) {
					if (providerMetadata.has(provider.type) || providerMetadata.size < 32) providerMetadata.set(provider.type, provider);
				}
				const metadata = order.accept(incoming, 'full', ticket);
				const providerInputs =
					!metadata && current
						? current.providers
						: [
								...incoming.providers,
								...(current?.providers.filter(
									(provider) =>
										!incoming.providers.some((item) => item.type === provider.type) && order.newerThan(`provider:${provider.type}`, incoming)
								) ?? []),
							];
				const providers = providerInputs.map((existing) => {
					const provider = incoming.providers.find((item) => item.type === existing.type) ?? existing;
					if (order.accept(provider, `provider:${provider.type}`, ticket)) return provider;
					return current?.providers.find((item) => item.type === provider.type) ?? provider;
				});
				if (metadata) {
					for (const type of providerMetadata.keys()) {
						if (!incoming.providers.some((provider) => provider.type === type)) order.accept(incoming, `provider:${type}`, ticket);
					}
				}
				const urls = order.accept(incoming.urls, 'urls', ticket) ? incoming.urls : (current?.urls ?? incoming.urls);
				data.value = { ...(metadata || !current ? incoming : current), providers, urls };
				// Aggregate provider advisories follow the accepted provider components.
				data.value.advisories = [
					...data.value.advisories.filter((item) => !item.provider),
					...providers.flatMap((provider) => provider.advisories.map((item) => ({ ...item, provider: item.provider ?? provider.type }))),
				];
				for (const [component, payload] of order.drain(ticket)) {
					if (order.accept(payload, component)) applyEvent(component === 'urls' ? EventType.URLS_CHANGED : EventType.PROVIDER_STATUS, payload);
				}
			}
			if (data.value === null) throw new Error('Remote access snapshot superseded before initial load.');
			return data.value;
		};
		const onEvent = (payload: IRemoteAccessStatusOnEventActionPayload): IRemoteAccessStatus | null => {
			if (payload.event !== EventType.PROVIDER_STATUS && payload.event !== EventType.URLS_CHANGED) {
				logger.warn(`Unhandled remote access status event: ${payload.event}`);
				return data.value;
			}
			const schema = payload.event === EventType.PROVIDER_STATUS ? RemoteAccessProviderStatusEventSchema : RemoteAccessUrlsChangedEventSchema;
			const parsed = schema.safeParse(snakeToCamel(payload.data));
			if (!parsed.success) {
				if (data.value === null) return null;
				throw new RemoteAccessValidationException('Failed to validate received remote access status event.');
			}
			const eventData = parsed.data;
			const component = payload.event === EventType.URLS_CHANGED ? 'urls' : `provider:${String(payload.data.type)}`;
			const decision = order.event(
				eventData,
				component,
				eventData,
				payload.event === EventType.PROVIDER_STATUS && data.value !== null && !providerMetadata.has(String(payload.data.type))
			);
			if (decision === 'buffer') {
				if (data.value !== null && !resynchronizing)
					void get(true).catch((error: unknown) => logger.error('Failed to resynchronize remote access status.', error));
			} else if (decision === 'accept') applyEvent(payload.event, eventData);
			return data.value;
		};

		const set = (payload: IRemoteAccessStatusSetActionPayload): IRemoteAccessStatus => {
			const parsedStatus = RemoteAccessStatusSchema.safeParse(payload.data);

			if (!parsedStatus.success) {
				logger.error('Schema validation failed with:', parsedStatus.error);

				throw new RemoteAccessValidationException('Failed to insert remote access status.');
			}

			return acceptStatus(parsedStatus.data, data.value === null ? order.request() : undefined);
		};

		const get = async (force = false): Promise<IRemoteAccessStatus> => {
			if (force) {
				resynchronizing = true;
				order.resync();
				getController?.abort();
				pendingGetPromises = null;
			}
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const ticket = order.request();
			const controller = new AbortController();
			getController = controller;
			const fetchPromise = (async (): Promise<IRemoteAccessStatus> => {
				semaphore.value.getting = true;

				// The request itself lives inside the `try` too: a rejection from `backend.client.GET`
				// (a network failure, not an HTTP error response - openapi-fetch resolves those into
				// `{ error }` instead of rejecting) must still hit `finally` below, or `getting` is stuck
				// `true` forever and every subsequent `get()` throws "Already getting ...".
				try {
					const apiResponse = await backend.client.GET(`/${MODULES_PREFIX}/${REMOTE_ACCESS_MODULE_PREFIX}/status`, { signal: controller.signal });

					const { data: responseData, error, response } = apiResponse;

					// Captured with an explicit type before any narrowing: `get-remote-access-module-status`
					// documents only a `200` response, so openapi-fetch's generated error union for this
					// operation has no inhabitable member, and TypeScript narrows the destructured
					// `response` binding itself to `never` in the branch below. `response` is always a real
					// `Response` at runtime regardless of which branch openapi-fetch took.
					const httpResponse: Response = response;

					if (typeof responseData !== 'undefined') {
						const accepted = acceptStatus(transformRemoteAccessStatusResponse(responseData.data), ticket);
						firstLoad.value = true;
						if (order.hasBuffered() && !resynchronizing) return get(true);

						return accepted;
					}

					let errorReason: string | null = 'Failed to fetch remote access status.';

					if (error) {
						errorReason = getErrorReason<RemoteAccessModuleGetStatusOperation>(error, errorReason);
					}

					throw new RemoteAccessApiException(errorReason, httpResponse.status);
				} catch (error: unknown) {
					if (!order.currentRequest(ticket)) {
						if (pendingGetPromises) return pendingGetPromises;
						if (data.value) return data.value;
					}
					throw error;
				} finally {
					if (order.currentRequest(ticket)) {
						semaphore.value.getting = false;
						resynchronizing = false;
					}
				}
			})();

			pendingGetPromises = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				if (pendingGetPromises === fetchPromise) pendingGetPromises = null;
			}
		};

		// Reconnect refresh contract: the store itself says whether it holds anything worth
		// re-reading, so the caller never has to guess from a flag it does not maintain.
		const isLoaded = (): boolean => data.value !== null || semaphore.value.getting || order.hasBuffered();

		const refresh = (): Promise<unknown> => get(true);

		return {
			isLoaded,
			refresh,
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			onEvent,
			set,
			get,
		};
	}
);

export const registerRemoteAccessStatusStore = (
	pinia: Pinia
): Store<string, IRemoteAccessStatusStoreState, object, IRemoteAccessStatusStoreActions> => {
	return useRemoteAccessStatus(pinia);
};
