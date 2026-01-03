import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useBackend } from '../../../common';
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
			data.value[name] ?? null;

		const pendingGetPromises: Record<IDiscoveredExtension['name'], Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }>> = {};

		const pendingFetchPromises: Record<string, Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]>> = {};

		const get = async (payload: IDiscoveredExtensionsGetActionPayload): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }> => {
			const existingPromise = pendingGetPromises[payload.name];
			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }> => {
				if (semaphore.value.fetching.item.includes(payload.name)) {
					throw new ExtensionsApiException('Already fetching discovered extension.');
				}

				semaphore.value.fetching.item.push(payload.name);

				try {
					const {
						data: responseData,
						response,
					} = await backend.client.GET('/modules/extensions/discovered/{name}', {
						params: {
							path: { name: payload.name },
						},
					});

					if (responseData?.data) {
						const merged: { [name: string]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } } = {};

						merged[payload.name] = {};

						for (const raw of responseData.data) {
							const transformedExtension = transformDiscoveredExtensionResponse(raw as unknown as IDiscoveredExtensionRes);

							if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
								throw new ExtensionsApiException('Received extension name is different');
							}

							const mergedItem = merged[transformedExtension.name];
							if (mergedItem) {
								if (transformedExtension.surface === 'admin') {
									mergedItem.admin = transformedExtension;
								} else {
									mergedItem.backend = transformedExtension;
								}
							}
						}

						data.value = { ...data.value, ...merged };

						return merged[payload.name] ?? { admin: undefined, backend: undefined };
					}

					const errorReason = 'Failed to fetch discovered extension.';

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
			const existingPromise = pendingFetchPromises['all'];
			if (existingPromise) {
				return existingPromise;
			}

			const fetchPromise = (async (): Promise<{ admin?: IDiscoveredExtension; backend?: IDiscoveredExtension }[]> => {
				if (semaphore.value.fetching.items) {
					throw new ExtensionsApiException('Already fetching discovered extensions.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, response } = await backend.client.GET('/modules/extensions/discovered');

					if (responseData?.data) {
						const merged: { [name: string]: { admin?: IDiscoveredExtension; backend?: IDiscoveredExtension } } = {};

						for (const raw of responseData.data) {
							const transformedExtension = transformDiscoveredExtensionResponse(raw as unknown as IDiscoveredExtensionRes);

							if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
								merged[transformedExtension.name] = {};
							}

							const mergedItem = merged[transformedExtension.name];
							if (mergedItem) {
								if (transformedExtension.surface === 'admin') {
									mergedItem.admin = transformedExtension;
								} else if (transformedExtension.surface === 'backend') {
									mergedItem.backend = transformedExtension;
								}
							}
						}

						data.value = merged;

						firstLoad.value = true;

						return Object.values(data.value);
					}

					const errorReason = 'Failed to fetch discovered extensions.';

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

export const registerDiscoveredExtensionsStore = (
	pinia: Pinia
): Store<'extensions_module-discovered', IDiscoveredExtensionsStoreState, object, IDiscoveredExtensionsStoreActions> => {
	return useDiscoveredExtensions(pinia);
};
