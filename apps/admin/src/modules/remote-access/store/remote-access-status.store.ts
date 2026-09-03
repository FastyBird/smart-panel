import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { RemoteAccessModuleGetStatusOperation } from '../../../openapi.constants';
import { EventType, REMOTE_ACCESS_MODULE_PREFIX } from '../remote-access.constants';
import { RemoteAccessApiException, RemoteAccessValidationException } from '../remote-access.exceptions';

import { RemoteAccessStatusSchema } from './remote-access-status.store.schemas';
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

		// Both `RemoteAccessModule.Provider.Status` and `RemoteAccessModule.Urls.Changed` update this
		// same snapshot from their event payload directly - no refetch, per the module spec. An event
		// arriving before the first `get()` has nothing to merge into and is dropped; the page always
		// fetches on mount, so this only matters for a stray event during that brief window.
		const onEvent = (payload: IRemoteAccessStatusOnEventActionPayload): IRemoteAccessStatus | null => {
			if (data.value === null) {
				logger.warn(`Received a remote access "${payload.event}" event before the initial status fetch; ignoring.`);

				return null;
			}

			switch (payload.event) {
				case EventType.PROVIDER_STATUS:
					return (data.value = applyRemoteAccessProviderStatusEvent(data.value, payload.data));

				case EventType.URLS_CHANGED:
					return (data.value = applyRemoteAccessUrlsChangedEvent(data.value, payload.data));

				default:
					logger.warn(`Unhandled remote access status event: ${payload.event}`);

					return data.value;
			}
		};

		const set = (payload: IRemoteAccessStatusSetActionPayload): IRemoteAccessStatus => {
			const parsedStatus = RemoteAccessStatusSchema.safeParse(payload.data);

			if (!parsedStatus.success) {
				logger.error('Schema validation failed with:', parsedStatus.error);

				throw new RemoteAccessValidationException('Failed to insert remote access status.');
			}

			return (data.value = parsedStatus.data);
		};

		const get = async (): Promise<IRemoteAccessStatus> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IRemoteAccessStatus> => {
				if (semaphore.value.getting) {
					throw new RemoteAccessApiException('Already getting remote access status.');
				}

				semaphore.value.getting = true;

				// The request itself lives inside the `try` too: a rejection from `backend.client.GET`
				// (a network failure, not an HTTP error response - openapi-fetch resolves those into
				// `{ error }` instead of rejecting) must still hit `finally` below, or `getting` is stuck
				// `true` forever and every subsequent `get()` throws "Already getting ...".
				try {
					const apiResponse = await backend.client.GET(`/${MODULES_PREFIX}/${REMOTE_ACCESS_MODULE_PREFIX}/status`);

					const { data: responseData, error, response } = apiResponse;

					// Captured with an explicit type before any narrowing: `get-remote-access-module-status`
					// documents only a `200` response, so openapi-fetch's generated error union for this
					// operation has no inhabitable member, and TypeScript narrows the destructured
					// `response` binding itself to `never` in the branch below. `response` is always a real
					// `Response` at runtime regardless of which branch openapi-fetch took.
					const httpResponse: Response = response;

					if (typeof responseData !== 'undefined') {
						data.value = transformRemoteAccessStatusResponse(responseData.data);
						firstLoad.value = true;

						return data.value;
					}

					let errorReason: string | null = 'Failed to fetch remote access status.';

					if (error) {
						errorReason = getErrorReason<RemoteAccessModuleGetStatusOperation>(error, errorReason);
					}

					throw new RemoteAccessApiException(errorReason, httpResponse.status);
				} finally {
					semaphore.value.getting = false;
				}
			})();

			pendingGetPromises = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingGetPromises = null;
			}
		};

		// Reconnect refresh contract: the store itself says whether it holds anything worth
		// re-reading, so the caller never has to guess from a flag it does not maintain.
		const isLoaded = (): boolean => data.value !== null;

		const refresh = (): Promise<unknown> => get();

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
