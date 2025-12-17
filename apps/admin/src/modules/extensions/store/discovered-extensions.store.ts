import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import { ExtensionSurface, EXTENSIONS_MODULE_PREFIX } from '../extensions.constants';
import { ExtensionsApiException } from '../extensions.exceptions';

import type {
	DiscoveredExtensionsStoreSetup,
	IDiscoveredExtension,
	IDiscoveredExtensionRes,
	IDiscoveredExtensionsGetActionPayload,
	IDiscoveredExtensionsStateSemaphore,
	IDiscoveredExtensionsStoreActions,
	IDiscoveredExtensionsStoreState,
} from './discovered-extensions.store.types';
import { transformDiscoveredExtensionResponse } from './discovered-extensions.transformers';

const defaultSemaphore: IDiscoveredExtensionsStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useDiscoveredExtensions = defineStore<'extensions_module-discovered', DiscoveredExtensionsStoreSetup>(
	'extensions_module-discovered',
	(): DiscoveredExtensionsStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IDiscoveredExtensionsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IDiscoveredExtension['name']]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (name: IDiscoveredExtension['name']): boolean => semaphore.value.fetching.item.includes(name);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[] => Object.values(data.value);

		const findByName = (name: IDiscoveredExtension['name']): { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } | null =>
			name in data.value ? data.value[name] : null;

		const pendingGetPromises: Record<IDiscoveredExtension['name'], Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }>> = {};

		const pendingFetchPromises: Record<string, Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]>> = {};

		const get = async (payload: IDiscoveredExtensionsGetActionPayload): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }> => {
			if (payload.name in pendingGetPromises) {
				return pendingGetPromises[payload.name];
			}

			const getPromise = (async (): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }> => {
				if (semaphore.value.fetching.item.includes(payload.name)) {
					throw new ExtensionsApiException('Already fetching discovered extension.');
				}

				semaphore.value.fetching.item.push(payload.name);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${EXTENSIONS_MODULE_PREFIX}/discovered/{name}` as `/${string}`, {
						params: {
							path: { name: payload.name },
						},
					});

					if (typeof responseData !== 'undefined') {
						const merged: { [name: string]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } } = {};

						merged[payload.name] = {};

						for (const raw of (responseData as { data: IDiscoveredExtensionRes[] }).data) {
							const transformedExtension = transformDiscoveredExtensionResponse(raw);

							if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
								throw new ExtensionsApiException('Received extension name is different');
							}

							if (transformedExtension.surface === ExtensionSurface.ADMIN) {
								merged[transformedExtension.name].admin = transformedExtension;
							} else {
								merged[transformedExtension.name].backend = transformedExtension;
							}
						}

						data.value = { ...data.value, ...merged };

						return merged[payload.name];
					}

					let errorReason: string | null = 'Failed to fetch discovered extension.';

					if (error) {
						errorReason = getErrorReason(error, errorReason);
					}

					throw new ExtensionsApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.name);
				}
			})();

			pendingGetPromises[payload.name] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.name];
			}
		};

		const fetch = async (): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]> => {
			if ('all' in pendingFetchPromises) {
				return pendingFetchPromises['all'];
			}

			const fetchPromise = (async (): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]> => {
				if (semaphore.value.fetching.items) {
					throw new ExtensionsApiException('Already fetching discovered extensions.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${EXTENSIONS_MODULE_PREFIX}/discovered` as `/${string}`);

					if (typeof responseData !== 'undefined') {
						const merged: { [name: string]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } } = {};

						for (const raw of (responseData as { data: IDiscoveredExtensionRes[] }).data) {
							const transformedExtension = transformDiscoveredExtensionResponse(raw);

							if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
								merged[transformedExtension.name] = {};
							}

							if (transformedExtension.surface === ExtensionSurface.ADMIN) {
								merged[transformedExtension.name].admin = transformedExtension;
							} else if (transformedExtension.surface === ExtensionSurface.BACKEND) {
								merged[transformedExtension.name].backend = transformedExtension;
							}
						}

						data.value = merged;

						firstLoad.value = true;

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch discovered extensions.';

					if (error) {
						errorReason = getErrorReason(error, errorReason);
					}

					throw new ExtensionsApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = false;
				}
			})();

			pendingFetchPromises['all'] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises['all'];
			}
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findByName,
			get,
			fetch,
		};
	}
);

export const registerDiscoveredExtensionsStore = (pinia: Pinia): Store<string, IDiscoveredExtensionsStoreState, object, IDiscoveredExtensionsStoreActions> => {
	return useDiscoveredExtensions(pinia);
};
