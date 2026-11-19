import { ref } from 'vue';

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

	let pendingFetchPromise: Promise<ICamera[]> | null = null;

	const pendingGetPromises: Record<string, Promise<ICamera>> = {};

	const findAll = (): ICamera[] => Object.values(data.value).sort((a, b) => a.name.localeCompare(b.name));

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

		if (pending) {
			return pending;
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

					data.value[camera.deviceId] = camera;

					return camera;
				}

				throw new CamerasApiException(readErrorMessage(error) ?? 'Failed to fetch camera.', response?.status ?? 500);
			} finally {
				semaphore.value.getting = semaphore.value.getting.filter((id) => id !== payload.deviceId);
			}
		})();

		pendingGetPromises[payload.deviceId] = getPromise;

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.deviceId];
		}
	};

	// Reconnect refresh contract: re-read only what this store already holds.
	const isLoaded = (): boolean => loaded;

	const refresh = (): Promise<unknown> => fetch();

	return { semaphore, data, findAll, findById, fetch, get, isLoaded, refresh };
});

export const registerCamerasStore = (pinia: Pinia): Store<string, ICamerasStoreState, object, ICamerasStoreActions> => {
	return useCameras(pinia);
};
