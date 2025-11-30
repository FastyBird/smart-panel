import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import { SystemModuleExtensionSurface } from '../../../openapi.constants';
import { type operations } from '../../../openapi';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';
import { SystemApiException } from '../system.exceptions';

import type {
	ExtensionsStoreSetup,
	IExtension,
	IExtensionsGetActionPayload,
	IExtensionsStateSemaphore,
	IExtensionsStoreActions,
	IExtensionsStoreState,
} from './extensions.store.types';
import { transformExtensionResponse } from './extensions.transformers';

const defaultSemaphore: IExtensionsStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useExtensions = defineStore<'system_module-logs', ExtensionsStoreSetup>('system_module-logs', (): ExtensionsStoreSetup => {
	const backend = useBackend();

	const semaphore = ref<IExtensionsStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IExtension['name']]: { admin?: IExtension; backend?: IExtension } }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (name: IExtension['name']): boolean => semaphore.value.fetching.item.includes(name);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): { admin?: IExtension; backend?: IExtension }[] => Object.values(data.value);

	const findByName = (name: IExtension['name']): { admin?: IExtension; backend?: IExtension } | null =>
		name in data.value ? data.value[name] : null;

	const pendingGetPromises: Record<IExtension['name'], Promise<{ admin?: IExtension; backend?: IExtension }>> = {};

	const pendingFetchPromises: Record<string, Promise<{ admin?: IExtension; backend?: IExtension }[]>> = {};

	const get = async (payload: IExtensionsGetActionPayload): Promise<{ admin?: IExtension; backend?: IExtension }> => {
		if (payload.name in pendingGetPromises) {
			return pendingGetPromises[payload.name];
		}

		const getPromise = (async (): Promise<{ admin?: IExtension; backend?: IExtension }> => {
			if (semaphore.value.fetching.item.includes(payload.name)) {
				throw new SystemApiException('Already fetching extension.');
			}

			semaphore.value.fetching.item.push(payload.name);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/extensions/{name}`, {
					params: {
						path: { name: payload.name },
					},
				});

				if (typeof responseData !== 'undefined') {
					const merged: { [name: string]: { admin?: IExtension; backend?: IExtension } } = {};

					merged[payload.name] = {};

					for (const raw of responseData.data) {
						const transformedExtension = transformExtensionResponse(raw);

						if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
							throw new SystemApiException('Received extension name is different');
						}

						if (transformedExtension.surface === SystemModuleExtensionSurface.admin) {
							merged[transformedExtension.name].admin = transformedExtension;
						} else {
							merged[transformedExtension.name].backend = transformedExtension;
						}
					}

					data.value = { ...data.value, ...merged };

					return merged[payload.name];
				}

				let errorReason: string | null = 'Failed to fetch extension.';

				if (error) {
					errorReason = getErrorReason<operations['get-system-module-extension']>(error, errorReason);
				}

				throw new SystemApiException(errorReason, response.status);
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

	const fetch = async (): Promise<{ admin?: IExtension; backend?: IExtension }[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<{ admin?: IExtension; backend?: IExtension }[]> => {
			if (semaphore.value.fetching.items) {
				throw new SystemApiException('Already fetching logs entries.');
			}

			semaphore.value.fetching.items = true;

			try {
				const { data: responseData, error, response } = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/extensions`);

				if (typeof responseData !== 'undefined') {
					const merged: { [name: string]: { admin?: IExtension; backend?: IExtension } } = {};

					for (const raw of responseData.data) {
						const transformedExtension = transformExtensionResponse(raw);

						if (!Object.prototype.hasOwnProperty.call(merged, transformedExtension.name)) {
							merged[transformedExtension.name] = {};
						}

						if (transformedExtension.surface === SystemModuleExtensionSurface.admin) {
							merged[transformedExtension.name].admin = transformedExtension;
						} else if (transformedExtension.surface === SystemModuleExtensionSurface.backend) {
							merged[transformedExtension.name].backend = transformedExtension;
						}
					}

					data.value = merged;

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch logs entries.';

				if (error) {
					errorReason = getErrorReason<operations['get-system-module-logs']>(error, errorReason);
				}

				throw new SystemApiException(errorReason, response.status);
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
});

export const registerExtensionsStore = (pinia: Pinia): Store<string, IExtensionsStoreState, object, IExtensionsStoreActions> => {
	return useExtensions(pinia);
};
