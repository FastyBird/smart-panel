import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	ExtensionsModuleGetServiceOperation,
	ExtensionsModuleGetServicesOperation,
	ExtensionsModuleRestartServiceOperation,
	ExtensionsModuleStartServiceOperation,
	ExtensionsModuleStopServiceOperation,
} from '../../../openapi.constants';
import { ExtensionsApiException, ExtensionsValidationException } from '../extensions.exceptions';

import { ServiceSchema } from './services.store.schemas';
import type {
	IService,
	IServiceRes,
	IServicesGetActionPayload,
	IServicesRestartActionPayload,
	IServicesSetActionPayload,
	IServicesStartActionPayload,
	IServicesStateSemaphore,
	IServicesStopActionPayload,
	IServicesStoreActions,
	IServicesStoreState,
	ServicesStoreSetup,
} from './services.store.types';
import { transformServiceResponse } from './services.transformers';

const defaultSemaphore: IServicesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	acting: [],
};

const serviceKey = (pluginName: string, serviceId: string): string => `${pluginName}:${serviceId}`;

export const useServices = defineStore<'extensions_module-services', ServicesStoreSetup>(
	'extensions_module-services',
	(): ServicesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IServicesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: string]: IService }>({});

		const pendingGetPromises: Record<string, Promise<IService>> = {};

		const pendingFetchPromises: Record<string, Promise<IService[]>> = {};

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (pluginName: string, serviceId: string): boolean =>
			semaphore.value.fetching.item.includes(serviceKey(pluginName, serviceId));

		const fetching = (): boolean => semaphore.value.fetching.items;

		const acting = (pluginName: string, serviceId: string): boolean =>
			semaphore.value.acting.includes(serviceKey(pluginName, serviceId));

		const findAll = (): IService[] => Object.values(data.value);

		const findByKey = (pluginName: string, serviceId: string): IService | null => {
			const key = serviceKey(pluginName, serviceId);
			return data.value[key] ?? null;
		};

		const set = (payload: IServicesSetActionPayload): IService => {
			const key = serviceKey(payload.pluginName, payload.serviceId);

			if (key in data.value) {
				const parsed = ServiceSchema.safeParse({ ...data.value[key], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new ExtensionsValidationException('Failed to update service.');
				}

				return (data.value[key] = parsed.data);
			}

			const parsed = ServiceSchema.safeParse(payload.data);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ExtensionsValidationException('Failed to insert service.');
			}

			data.value = data.value ?? {};

			return (data.value[key] = parsed.data);
		};

		const get = async (payload: IServicesGetActionPayload): Promise<IService> => {
			const key = serviceKey(payload.pluginName, payload.serviceId);

			const existingPromise = pendingGetPromises[key];
			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IService> => {
				if (semaphore.value.fetching.item.includes(key)) {
					throw new ExtensionsApiException('Already fetching service.');
				}

				semaphore.value.fetching.item.push(key);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET('/modules/extensions/services/{pluginName}/{serviceId}', {
						params: {
							path: { pluginName: payload.pluginName, serviceId: payload.serviceId },
						},
					});

					if (typeof responseData !== 'undefined') {
						const service = transformServiceResponse(responseData.data as unknown as IServiceRes);

						data.value[key] = service;

						return service;
					}

					let errorReason: string | null = 'Failed to fetch service.';

					if (error) {
						errorReason = getErrorReason<ExtensionsModuleGetServiceOperation>(error, errorReason);
					}

					throw new ExtensionsApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== key);
				}
			})();

			pendingGetPromises[key] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[key];
			}
		};

		const fetch = async (): Promise<IService[]> => {
			const cacheKey = 'all';

			if (cacheKey in pendingFetchPromises) {
				return pendingFetchPromises[cacheKey];
			}

			const fetchPromise = (async (): Promise<IService[]> => {
				if (semaphore.value.fetching.items) {
					throw new ExtensionsApiException('Already fetching services.');
				}

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET('/modules/extensions/services');

					if (responseData?.data) {
						const services = responseData.data.map((svc) => transformServiceResponse(svc as unknown as IServiceRes));

						// Update store data
						for (const service of services) {
							const key = serviceKey(service.pluginName, service.serviceId);
							data.value[key] = service;
						}

						firstLoad.value = true;

						return services;
					}

					let errorReason: string | null = 'Failed to fetch services.';

					if (error) {
						errorReason = getErrorReason<ExtensionsModuleGetServicesOperation>(error, errorReason);
					}

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

		const start = async (payload: IServicesStartActionPayload): Promise<IService> => {
			const key = serviceKey(payload.pluginName, payload.serviceId);

			if (semaphore.value.acting.includes(key)) {
				throw new ExtensionsApiException('Action is already in progress for this service.');
			}

			semaphore.value.acting.push(key);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST('/modules/extensions/services/{pluginName}/{serviceId}/start', {
					params: {
						path: { pluginName: payload.pluginName, serviceId: payload.serviceId },
					},
				});

				if (typeof responseData !== 'undefined') {
					const service = transformServiceResponse(responseData.data as unknown as IServiceRes);

					data.value[key] = service;

					return service;
				}

				let errorReason: string | null = 'Failed to start service.';

				if (error) {
					errorReason = getErrorReason<ExtensionsModuleStartServiceOperation>(error, errorReason);
				}

				throw new ExtensionsApiException(errorReason, response.status);
			} finally {
				semaphore.value.acting = semaphore.value.acting.filter((item) => item !== key);
			}
		};

		const stop = async (payload: IServicesStopActionPayload): Promise<IService> => {
			const key = serviceKey(payload.pluginName, payload.serviceId);

			if (semaphore.value.acting.includes(key)) {
				throw new ExtensionsApiException('Action is already in progress for this service.');
			}

			semaphore.value.acting.push(key);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST('/modules/extensions/services/{pluginName}/{serviceId}/stop', {
					params: {
						path: { pluginName: payload.pluginName, serviceId: payload.serviceId },
					},
				});

				if (typeof responseData !== 'undefined') {
					const service = transformServiceResponse(responseData.data as unknown as IServiceRes);

					data.value[key] = service;

					return service;
				}

				let errorReason: string | null = 'Failed to stop service.';

				if (error) {
					errorReason = getErrorReason<ExtensionsModuleStopServiceOperation>(error, errorReason);
				}

				throw new ExtensionsApiException(errorReason, response.status);
			} finally {
				semaphore.value.acting = semaphore.value.acting.filter((item) => item !== key);
			}
		};

		const restart = async (payload: IServicesRestartActionPayload): Promise<IService> => {
			const key = serviceKey(payload.pluginName, payload.serviceId);

			if (semaphore.value.acting.includes(key)) {
				throw new ExtensionsApiException('Action is already in progress for this service.');
			}

			semaphore.value.acting.push(key);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST('/modules/extensions/services/{pluginName}/{serviceId}/restart', {
					params: {
						path: { pluginName: payload.pluginName, serviceId: payload.serviceId },
					},
				});

				if (typeof responseData !== 'undefined') {
					const service = transformServiceResponse(responseData.data as unknown as IServiceRes);

					data.value[key] = service;

					return service;
				}

				let errorReason: string | null = 'Failed to restart service.';

				if (error) {
					errorReason = getErrorReason<ExtensionsModuleRestartServiceOperation>(error, errorReason);
				}

				throw new ExtensionsApiException(errorReason, response.status);
			} finally {
				semaphore.value.acting = semaphore.value.acting.filter((item) => item !== key);
			}
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			fetching,
			acting,
			findAll,
			findByKey,
			set,
			get,
			fetch,
			start,
			stop,
			restart,
		};
	}
);

export const registerServicesStore = (
	pinia: Pinia
): Store<'extensions_module-services', IServicesStoreState, object, IServicesStoreActions> => {
	return useServices(pinia);
};
