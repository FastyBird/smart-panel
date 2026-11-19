import { ref, shallowRef, toRaw } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { CAMERAS_MODULE_PREFIX } from '../cameras.constants';
import { CamerasApiException } from '../cameras.exceptions';
import { readErrorMessage } from '../cameras.utils';

import type {
	CamerasStoreSetup,
	ICamera,
	ICamerasGetActionPayload,
	ICamerasStateSemaphore,
	ICamerasStoreActions,
	ICamerasStoreState,
} from './cameras.store.types';
import { transformCameraResponse } from './cameras.transformers';

export const useCameras = defineStore<'cameras_module-cameras', CamerasStoreSetup>('cameras_module-cameras', (): CamerasStoreSetup => {
	const backend = useBackend();

	const semaphore = ref<ICamerasStateSemaphore>({
		fetching: false,
		getting: [],
	});

	const data = ref<{ [deviceId: ICamera['deviceId']]: ICamera }>({});

	let loaded = false;

	/** The cameras of the last list. The list leaves hidden devices out, which `get()` can still hold for a device page. */
	const listed = shallowRef<ReadonlySet<ICamera['deviceId']>>(new Set());

	/** Cameras read one by one through `get()`; a reconnect refresh reads again the ones the list does not cover. */
	const detailIds = new Set<ICamera['deviceId']>();

	let pendingFetchPromise: Promise<ICamera[]> | null = null;

	const pendingGetPromises: Record<string, { cached: ICamera | undefined; promise: Promise<ICamera> }> = {};

	const findAll = (): ICamera[] =>
		Object.values(data.value)
			.filter((camera) => !loaded || listed.value.has(camera.deviceId))
			.sort((a, b) => a.name.localeCompare(b.name));

	const findById = (deviceId: ICamera['deviceId']): ICamera | null => (deviceId in data.value ? data.value[deviceId] : null);

	const fetch = async (): Promise<ICamera[]> => {
		if (pendingFetchPromise) {
			return pendingFetchPromise;
		}

		const fetchPromise = (async (): Promise<ICamera[]> => {
			semaphore.value.fetching = true;

			try {
				const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/cameras`, {});

				if (typeof responseData !== 'undefined') {
					const next: { [deviceId: ICamera['deviceId']]: ICamera } = {};

					for (const row of responseData.data) {
						const camera = transformCameraResponse(row);

						next[camera.deviceId] = camera;
					}

					// Listed cameras missing from the response are gone, so the list is replaced.
					listed.value = new Set(Object.keys(next));

					// A camera read through `get()` that the list leaves out (a hidden device) stays cached, off the list,
					// until a detail read answers 404; a transient failure of that read must not lose it.
					for (const deviceId of detailIds) {
						if (!(deviceId in next) && deviceId in data.value) {
							next[deviceId] = data.value[deviceId];
						}
					}

					data.value = next;
					loaded = true;

					return Object.values(next);
				}

				throw new CamerasApiException(readErrorMessage(error) ?? 'Failed to fetch cameras.', response?.status ?? 500);
			} finally {
				semaphore.value.fetching = false;
			}
		})();

		pendingFetchPromise = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			pendingFetchPromise = null;
		}
	};

	const get = async (payload: ICamerasGetActionPayload): Promise<ICamera> => {
		const pending = pendingGetPromises[payload.deviceId];
		// The cached object this read starts from; a newer list entry or read replaces it, a carried over one does not.
		const cached = toRaw(data.value[payload.deviceId]);

		// A read that started from another cached object would not be cached; a newer caller needs one that is.
		if (pending && pending.cached === cached) {
			return pending.promise;
		}

		const getPromise = (async (): Promise<ICamera> => {
			semaphore.value.getting.push(payload.deviceId);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/cameras/{deviceId}`, {
					params: { path: { deviceId: payload.deviceId } },
				});

				if (typeof responseData !== 'undefined') {
					const camera = transformCameraResponse(responseData.data);

					// A camera read through `get()` is held for the device page whether or not this response is cached, so a
					// later list that leaves it out carries it over and a refresh reads it again.
					detailIds.add(camera.deviceId);

					// A list or read that changed this camera meanwhile is newer; this response must not bring back a camera
					// the list removed. A list that only carried the same object over does not make it stale.
					if (toRaw(data.value[camera.deviceId]) === cached) {
						data.value[camera.deviceId] = camera;
					}

					return camera;
				}

				throw new CamerasApiException(readErrorMessage(error) ?? 'Failed to fetch camera.', response?.status ?? 500);
			} finally {
				semaphore.value.getting = semaphore.value.getting.filter((id) => id !== payload.deviceId);
			}
		})();

		const entry = { cached, promise: getPromise };

		pendingGetPromises[payload.deviceId] = entry;

		try {
			return await getPromise;
		} finally {
			if (pendingGetPromises[payload.deviceId] === entry) {
				delete pendingGetPromises[payload.deviceId];
			}
		}
	};

	// Reconnect refresh contract: re-read only what this store already holds, which includes cameras read only through
	// `get()`, such as for a device page opened directly.
	const isLoaded = (): boolean => loaded || Object.keys(data.value).length > 0;

	/**
	 * Reads the list again when one was loaded, then each camera read through `get()` that the list does not cover, such
	 * as a hidden device on its device page. A camera that is gone is dropped.
	 */
	const refresh = async (): Promise<unknown> => {
		if (loaded) {
			await fetch();
		}

		const ids = [...detailIds].filter((deviceId) => !loaded || !listed.value.has(deviceId));

		return Promise.all(
			ids.map(async (deviceId): Promise<void> => {
				// A newer list entry or detail read replaces the cached object; a list that only carries it over does not.
				const cached = toRaw(data.value[deviceId]);

				try {
					await get({ deviceId });
				} catch (error) {
					if (error instanceof CamerasApiException && error.code === 404) {
						if (toRaw(data.value[deviceId]) !== cached) {
							return;
						}

						detailIds.delete(deviceId);
						delete data.value[deviceId];

						return;
					}

					throw error;
				}
			})
		);
	};

	return { semaphore, data, findAll, findById, fetch, get, isLoaded, refresh };
});

export const registerCamerasStore = (pinia: Pinia): Store<string, ICamerasStoreState, object, ICamerasStoreActions> => {
	return useCameras(pinia);
};
