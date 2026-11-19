import { ref, shallowRef } from 'vue';

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

	/** Increased by every list that replaced the cache; a detail response that started before it is not cached. */
	let listGeneration = 0;

	let pendingFetchPromise: Promise<ICamera[]> | null = null;

	const pendingGetPromises: Record<string, { generation: number; promise: Promise<ICamera> }> = {};

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

					// Cameras missing from the response are gone, so the whole map is replaced.
					listGeneration++;
					listed.value = new Set(Object.keys(next));
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
		const generation = listGeneration;

		// A read that started before the last list would not be cached; a newer caller needs one that is.
		if (pending && pending.generation === generation) {
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

					// A list that completed meanwhile is newer; this response must not bring back a camera it removed.
					if (generation === listGeneration) {
						data.value[camera.deviceId] = camera;
						detailIds.add(camera.deviceId);
					}

					return camera;
				}

				throw new CamerasApiException(readErrorMessage(error) ?? 'Failed to fetch camera.', response?.status ?? 500);
			} finally {
				semaphore.value.getting = semaphore.value.getting.filter((id) => id !== payload.deviceId);
			}
		})();

		const entry = { generation, promise: getPromise };

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
				const generation = listGeneration;

				try {
					await get({ deviceId });
				} catch (error) {
					if (error instanceof CamerasApiException && error.code === 404) {
						// A list that completed meanwhile is newer than this 404, and a read after it may have re-cached the camera.
						if (generation !== listGeneration) {
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
