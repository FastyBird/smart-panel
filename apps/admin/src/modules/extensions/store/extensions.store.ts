import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useBackend, useLogger } from '../../../common';
import { ExtensionKind } from '../extensions.constants';
import { ExtensionsApiException, ExtensionsValidationException } from '../extensions.exceptions';

import { ExtensionSchema, ExtensionsUpdateActionPayloadSchema } from './extensions.store.schemas';
import type {
	ExtensionsStoreSetup,
	IExtension,
	IExtensionRes,
	IExtensionsFetchActionPayload,
	IExtensionsGetActionPayload,
	IExtensionsSetActionPayload,
	IExtensionsStateSemaphore,
	IExtensionsStoreActions,
	IExtensionsStoreState,
	IExtensionsUpdateActionPayload,
} from './extensions.store.types';
import { transformExtensionResponse, transformExtensionUpdateRequest } from './extensions.transformers';

const defaultSemaphore: IExtensionsStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	updating: [],
};

export const useExtensions = defineStore<'extensions_module-extensions', ExtensionsStoreSetup>(
	'extensions_module-extensions',
	(): ExtensionsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IExtensionsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IExtension['type']]: IExtension }>({});

		const pendingGetPromises: Record<IExtension['type'], Promise<IExtension>> = {};

		const pendingFetchPromises: Record<string, Promise<IExtension[]>> = {};

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (type: IExtension['type']): boolean => semaphore.value.fetching.item.includes(type);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IExtension[] => Object.values(data.value);

		const findByKind = (kind: ExtensionKind): IExtension[] => Object.values(data.value).filter((ext) => ext.kind === kind);

		const findByType = (type: IExtension['type']): IExtension | null => (type in data.value ? data.value[type] : null);

		const set = (payload: IExtensionsSetActionPayload): IExtension => {
			if (payload.type && data.value && payload.type in data.value) {
				const parsed = ExtensionSchema.safeParse({ ...data.value[payload.type], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new ExtensionsValidationException('Failed to update extension.');
				}

				return (data.value[parsed.data.type] = parsed.data);
			}

			const parsed = ExtensionSchema.safeParse({ ...payload.data, type: payload.type });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ExtensionsValidationException('Failed to insert extension.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.type] = parsed.data);
		};

		const get = async (payload: IExtensionsGetActionPayload): Promise<IExtension> => {
			if (payload.type in pendingGetPromises) {
				return pendingGetPromises[payload.type];
			}

			const getPromise = (async (): Promise<IExtension> => {
				if (semaphore.value.fetching.item.includes(payload.type)) {
					throw new ExtensionsApiException('Already fetching extension.');
				}

				semaphore.value.fetching.item.push(payload.type);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET('/modules/extensions/extensions/{type}', {
						params: {
							path: { type: payload.type },
						},
					});

					if (typeof responseData !== 'undefined') {
						const extension = transformExtensionResponse(responseData.data as unknown as IExtensionRes);

						data.value[extension.type] = extension;

						return extension;
					}

					const errorReason: string | null = error ? 'Failed to fetch extension.' : 'Failed to fetch extension.';

					throw new ExtensionsApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.type);
				}
			})();

			pendingGetPromises[payload.type] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.type];
			}
		};

		const fetch = async (payload?: IExtensionsFetchActionPayload): Promise<IExtension[]> => {
			const cacheKey = payload?.kind ?? 'all';

			if (cacheKey in pendingFetchPromises) {
				return pendingFetchPromises[cacheKey];
			}

			const fetchPromise = (async (): Promise<IExtension[]> => {
				if (semaphore.value.fetching.items) {
					throw new ExtensionsApiException('Already fetching extensions.');
				}

				semaphore.value.fetching.items = true;

				try {
					let responseData;
					let error;
					let response;

					if (payload?.kind === ExtensionKind.MODULE) {
						({ data: responseData, error, response } = await backend.client.GET('/modules/extensions/extensions/modules'));
					} else if (payload?.kind === ExtensionKind.PLUGIN) {
						({ data: responseData, error, response } = await backend.client.GET('/modules/extensions/extensions/plugins'));
					} else {
						({ data: responseData, error, response } = await backend.client.GET('/modules/extensions/extensions'));
					}

					if (responseData?.data) {
						const extensions = responseData.data.map((ext) => transformExtensionResponse(ext as unknown as IExtensionRes));

						// Update store data
						for (const extension of extensions) {
							data.value[extension.type] = extension;
						}

						firstLoad.value = true;

						return extensions;
					}

					const errorReason: string | null = error ? 'Failed to fetch extensions.' : 'Failed to fetch extensions.';

					throw new ExtensionsApiException(errorReason, response?.status);
				} finally {
					semaphore.value.fetching.items = false;
				}
			})();

			pendingFetchPromises[cacheKey] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises[cacheKey];
			}
		};

		const update = async (payload: IExtensionsUpdateActionPayload): Promise<IExtension> => {
			const parsedPayload = ExtensionsUpdateActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ExtensionsValidationException('Failed to update extension.');
			}

			if (semaphore.value.updating.includes(payload.type)) {
				throw new ExtensionsApiException('Extension is already being updated.');
			}

			semaphore.value.updating.push(payload.type);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH('/modules/extensions/extensions/{type}', {
					params: {
						path: {
							type: payload.type,
						},
					},
					body: {
						data: transformExtensionUpdateRequest(parsedPayload.data.data),
					},
				});

				if (typeof responseData !== 'undefined') {
					const extension = transformExtensionResponse(responseData.data as unknown as IExtensionRes);

					data.value[extension.type] = extension;

					return extension;
				}

				// Updating failed, refresh to get current state
				await get({ type: payload.type });

				const errorReason: string | null = error ? 'Failed to update extension.' : 'Failed to update extension.';

				throw new ExtensionsApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.type);
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
			findByKind,
			findByType,
			set,
			get,
			fetch,
			update,
		};
	}
);

export const registerExtensionsStore = (
	pinia: Pinia
): Store<'extensions_module-extensions', IExtensionsStoreState, object, IExtensionsStoreActions> => {
	return useExtensions(pinia);
};
