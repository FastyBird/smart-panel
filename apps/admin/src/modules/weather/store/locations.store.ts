import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';

import {
	WeatherLocationSchema,
	WeatherLocationsAddActionPayloadSchema,
	WeatherLocationsEditActionPayloadSchema,
} from './locations.store.schemas';
import type {
	IWeatherLocation,
	IWeatherLocationRes,
	IWeatherLocationsStateSemaphore,
	IWeatherLocationsOnEventActionPayload,
	IWeatherLocationsSetActionPayload,
	IWeatherLocationsUnsetActionPayload,
	IWeatherLocationsGetActionPayload,
	IWeatherLocationsAddActionPayload,
	IWeatherLocationsEditActionPayload,
	IWeatherLocationsSaveActionPayload,
	IWeatherLocationsRemoveActionPayload,
	IWeatherLocationsStoreState,
	IWeatherLocationsStoreActions,
	WeatherLocationsStoreSetup,
} from './locations.store.types';
import {
	transformLocationResponse,
	transformLocationCreateRequest,
	transformLocationUpdateRequest,
} from './locations.transformers';

const extractErrorMessage = (error: unknown, fallback: string): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
		return (error as { message: string }).message;
	}
	return fallback;
};

const createDefaultSemaphore = (): IWeatherLocationsStateSemaphore => ({
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
});

export const useWeatherLocations = defineStore<'weather_module-locations', WeatherLocationsStoreSetup>(
	'weather_module-locations',
	(): WeatherLocationsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IWeatherLocationsStateSemaphore>(createDefaultSemaphore());

		const firstLoad = ref<boolean>(false);

		const data = ref<Record<IWeatherLocation['id'], IWeatherLocation>>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (id: IWeatherLocation['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IWeatherLocation[] => Object.values(data.value);

		const findById = (id: IWeatherLocation['id']): IWeatherLocation | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<IWeatherLocation>> = {};

		const pendingFetchPromises: Record<string, Promise<IWeatherLocation[]>> = {};

		const onEvent = (payload: IWeatherLocationsOnEventActionPayload): IWeatherLocation => {
			return set({
				id: payload.id,
				data: transformLocationResponse(payload.data as unknown as IWeatherLocationRes),
			});
		};

		const set = (payload: IWeatherLocationsSetActionPayload): IWeatherLocation => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = WeatherLocationSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('[WEATHER_MODULE] Schema validation failed:', parsed.error);

					throw new WeatherValidationException('Failed to insert location.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = WeatherLocationSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('[WEATHER_MODULE] Schema validation failed:', parsed.error);

				throw new WeatherValidationException('Failed to insert location.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IWeatherLocationsUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			delete data.value[payload.id];
		};

		const get = async (payload: IWeatherLocationsGetActionPayload): Promise<IWeatherLocation> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<IWeatherLocation> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new WeatherApiException('Already fetching location.');
				}

				semaphore.value.fetching.item.push(payload.id);

				const location = findById(payload.id);

				if (location && !location.draft) {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

					return location;
				}

				try {
					const response = await backend.client.GET(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations/{id}` as never, {
						params: {
							path: { id: payload.id },
						},
					} as never);

					const responseData = (response as { data?: { data: IWeatherLocationRes } }).data;

					if (typeof responseData !== 'undefined') {
						const transformed = transformLocationResponse(responseData.data);

						return set({ id: transformed.id, data: transformed });
					}

					throw new WeatherApiException('Received invalid response');
				} catch (error: unknown) {
					const apiError = error as { status?: number; message?: string };

					const errorReason = extractErrorMessage(error, 'Failed to fetch location');

					if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
						throw new WeatherApiException(errorReason, Number(apiError.status));
					}

					throw new WeatherApiException(errorReason);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
				}
			})();

			pendingGetPromises[payload.id] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.id];
			}
		};

		const fetch = async (): Promise<IWeatherLocation[]> => {
			const cacheKey = 'all';

			if (cacheKey in pendingFetchPromises) {
				return pendingFetchPromises[cacheKey];
			}

			const fetchPromise = (async (): Promise<IWeatherLocation[]> => {
				if (semaphore.value.fetching.items) {
					throw new WeatherApiException('Already fetching locations.');
				}

				semaphore.value.fetching.items = true;

				firstLoad.value = false;

				try {
					const response = await backend.client.GET(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations` as never);

					const responseData = (response as { data?: { data: IWeatherLocationRes[] } }).data;

					if (typeof responseData !== 'undefined') {
						const locations: IWeatherLocation[] = [];

						for (const item of responseData.data) {
							const transformed = transformLocationResponse(item);

							locations.push(set({ id: transformed.id, data: transformed }));
						}

						firstLoad.value = true;

						return locations;
					}

					throw new WeatherApiException('Received invalid response');
				} catch (error: unknown) {
					const apiError = error as { status?: number; message?: string };

					const errorReason = extractErrorMessage(error, 'Failed to fetch locations');

					if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
						throw new WeatherApiException(errorReason, Number(apiError.status));
					}

					throw new WeatherApiException(errorReason);
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

		const add = async (payload: IWeatherLocationsAddActionPayload): Promise<IWeatherLocation> => {
			const parsed = WeatherLocationsAddActionPayloadSchema.safeParse(payload);

			if (!parsed.success) {
				logger.error('[WEATHER_MODULE] Schema validation failed:', parsed.error);

				throw new WeatherValidationException('Failed to add location.');
			}

			const parsedPayload = parsed.data;

			semaphore.value.creating.push(parsedPayload.id);

			const newLocation = WeatherLocationSchema.safeParse({
				id: parsedPayload.id,
				draft: parsedPayload.draft,
				...parsedPayload.data,
				createdAt: new Date(),
				updatedAt: null,
			});

			if (!newLocation.success) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedPayload.id);

				throw new WeatherValidationException('Failed to add location.');
			}

			data.value[newLocation.data.id] = newLocation.data;

			if (parsedPayload.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedPayload.id);

				return newLocation.data;
			}

			try {
				const createReq = transformLocationCreateRequest({
					id: parsedPayload.id,
					type: parsedPayload.data.type,
					name: parsedPayload.data.name,
					...omitBy(parsedPayload.data, isUndefined),
				});

				const response = await backend.client.POST(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations` as never, {
					body: { data: createReq },
				} as never);

				const responseData = (response as { data?: { data: IWeatherLocationRes } }).data;

				if (typeof responseData !== 'undefined') {
					const transformed = transformLocationResponse(responseData.data);

					return set({ id: transformed.id, data: transformed });
				}

				throw new WeatherApiException('Received invalid response');
			} catch (error: unknown) {
				unset({ id: parsedPayload.id });

				const apiError = error as { status?: number; message?: string };

				const errorReason = extractErrorMessage(error, 'Failed to add location');

				if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
					throw new WeatherApiException(errorReason, Number(apiError.status));
				}

				throw new WeatherApiException(errorReason);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedPayload.id);
			}
		};

		const edit = async (payload: IWeatherLocationsEditActionPayload): Promise<IWeatherLocation> => {
			const parsed = WeatherLocationsEditActionPayloadSchema.safeParse(payload);

			if (!parsed.success) {
				logger.error('[WEATHER_MODULE] Schema validation failed:', parsed.error);

				throw new WeatherValidationException('Failed to edit location.');
			}

			const parsedPayload = parsed.data;

			if (semaphore.value.updating.includes(parsedPayload.id)) {
				throw new WeatherApiException('Location is already being updated.');
			}

			const existing = findById(parsedPayload.id);

			if (!existing) {
				throw new WeatherApiException('Location not found.');
			}

			semaphore.value.updating.push(parsedPayload.id);

			const updatedData = { ...existing, ...omitBy(parsedPayload.data, isUndefined) };

			data.value[parsedPayload.id] = updatedData;

			if (existing.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedPayload.id);

				return updatedData;
			}

			try {
				const updateReq = transformLocationUpdateRequest({
					type: parsedPayload.data.type,
					...omitBy(parsedPayload.data, isUndefined),
				});

				const response = await backend.client.PATCH(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations/{id}` as never, {
					params: {
						path: { id: parsedPayload.id },
					},
					body: { data: updateReq },
				} as never);

				const responseData = (response as { data?: { data: IWeatherLocationRes } }).data;

				if (typeof responseData !== 'undefined') {
					const transformed = transformLocationResponse(responseData.data);

					return set({ id: transformed.id, data: transformed });
				}

				throw new WeatherApiException('Received invalid response');
			} catch (error: unknown) {
				data.value[parsedPayload.id] = existing;

				const apiError = error as { status?: number; message?: string };

				const errorReason = extractErrorMessage(error, 'Failed to edit location');

				if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
					throw new WeatherApiException(errorReason, Number(apiError.status));
				}

				throw new WeatherApiException(errorReason);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedPayload.id);
			}
		};

		const save = async (payload: IWeatherLocationsSaveActionPayload): Promise<IWeatherLocation> => {
			const existing = findById(payload.id);

			if (!existing) {
				throw new WeatherApiException('Location not found.');
			}

			if (!existing.draft) {
				return existing;
			}

			semaphore.value.updating.push(payload.id);

			try {
				const createReq = transformLocationCreateRequest({
					id: existing.id,
					type: existing.type,
					name: existing.name,
				});

				const response = await backend.client.POST(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations` as never, {
					body: { data: createReq },
				} as never);

				const responseData = (response as { data?: { data: IWeatherLocationRes } }).data;

				if (typeof responseData !== 'undefined') {
					const transformed = transformLocationResponse(responseData.data);

					return set({ id: transformed.id, data: transformed });
				}

				throw new WeatherApiException('Received invalid response');
			} catch (error: unknown) {
				const apiError = error as { status?: number; message?: string };

				const errorReason = extractErrorMessage(error, 'Failed to save location');

				if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
					throw new WeatherApiException(errorReason, Number(apiError.status));
				}

				throw new WeatherApiException(errorReason);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: IWeatherLocationsRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new WeatherApiException('Location is already being deleted.');
			}

			const existing = findById(payload.id);

			if (!existing) {
				return true;
			}

			semaphore.value.deleting.push(payload.id);

			unset({ id: payload.id });

			if (existing.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

				return true;
			}

			try {
				const response = await backend.client.DELETE(`/${MODULES_PREFIX}/${WEATHER_MODULE_PREFIX}/locations/{id}` as never, {
					params: {
						path: { id: payload.id },
					},
				} as never);

				if ((response as { response: { status: number } }).response.status === 204) {
					return true;
				}

				throw new WeatherApiException('Failed to delete location');
			} catch (error: unknown) {
				await get({ id: payload.id });

				const apiError = error as { status?: number; message?: string };

				const errorReason = extractErrorMessage(error, 'Failed to delete location');

				if (apiError.status && [401, 403, 404, 422, 500].includes(Number(apiError.status))) {
					throw new WeatherApiException(errorReason, Number(apiError.status));
				}

				throw new WeatherApiException(errorReason);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		};

		return {
			data,
			semaphore,
			firstLoad,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findById,
			onEvent,
			set,
			unset,
			get,
			fetch,
			add,
			edit,
			save,
			remove,
		};
	}
);

export const registerWeatherLocationsStore = (
	pinia: Pinia
): Store<string, IWeatherLocationsStoreState, object, IWeatherLocationsStoreActions> => {
	return useWeatherLocations(pinia);
};
