import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantStateSchema } from './home-assistant-states.store.schemas';
import type {
	HomeAssistantStatesStoreSetup,
	IHomeAssistantState,
	IHomeAssistantStatesGetActionPayload,
	IHomeAssistantStatesSetActionPayload,
	IHomeAssistantStatesStateSemaphore,
	IHomeAssistantStatesStoreActions,
	IHomeAssistantStatesStoreState,
	IHomeAssistantStatesUnsetActionPayload,
} from './home-assistant-states.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';

const defaultSemaphore: IHomeAssistantStatesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useHomeAssistantStates = defineStore<'devices_home_assistant_plugin-states', HomeAssistantStatesStoreSetup>(
	'devices_home_assistant_plugin-states',
	(): HomeAssistantStatesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IHomeAssistantStatesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IHomeAssistantState['entityId']]: IHomeAssistantState }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (id: IHomeAssistantState['entityId']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IHomeAssistantState[] => Object.values(data.value);

		const findById = (id: IHomeAssistantState['entityId']): IHomeAssistantState | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<IHomeAssistantState>> = {};

		const pendingFetchPromises: Record<string, Promise<IHomeAssistantState[]>> = {};

		const set = (payload: IHomeAssistantStatesSetActionPayload): IHomeAssistantState => {
			if (payload.entityId && data.value && payload.entityId in data.value) {
				const parsedHomeAssistantState = HomeAssistantStateSchema.safeParse({ ...data.value[payload.entityId], ...payload.data });

				if (!parsedHomeAssistantState.success) {
					logger.error('Schema validation failed with:', parsedHomeAssistantState.error);

					throw new DevicesHomeAssistantValidationException('Failed to insert HomeAssistantState.');
				}

				return (data.value[parsedHomeAssistantState.data.entityId] = parsedHomeAssistantState.data);
			}

			const parsedHomeAssistantState = HomeAssistantStateSchema.safeParse({ ...payload.data, entityId: payload.entityId });

			if (!parsedHomeAssistantState.success) {
				logger.error('Schema validation failed with:', parsedHomeAssistantState.error);

				throw new DevicesHomeAssistantValidationException('Failed to insert Home Assistant device.');
			}

			data.value = data.value ?? {};

			return (data.value[parsedHomeAssistantState.data.entityId] = parsedHomeAssistantState.data);
		};

		const unset = (payload: IHomeAssistantStatesUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			delete data.value[payload.entityId];
		};

		const get = async (payload: IHomeAssistantStatesGetActionPayload): Promise<IHomeAssistantState> => {
			if (payload.entityId in pendingGetPromises) {
				return pendingGetPromises[payload.entityId];
			}

			const fetchPromise = (async (): Promise<IHomeAssistantState> => {
				if (semaphore.value.fetching.item.includes(payload.entityId)) {
					throw new DevicesHomeAssistantApiException('Already fetching HomeAssistantState.');
				}

				semaphore.value.fetching.item.push(payload.entityId);

				const apiResponse = await backend.client.GET(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/states/{entityId}`, {
					params: {
						path: { entityId: payload.entityId },
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.entityId);

				if (typeof responseData !== 'undefined') {
					const transformed = transformHomeAssistantStateResponse(responseData.data);

					data.value[transformed.entityId] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch HomeAssistantState.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-home-assistant-plugin-state']>(error, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
			})();

			pendingGetPromises[payload.entityId] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingGetPromises[payload.entityId];
			}
		};

		const fetch = async (): Promise<IHomeAssistantState[]> => {
			if ('all' in pendingFetchPromises) {
				return pendingFetchPromises['all'];
			}

			const fetchPromise = (async (): Promise<IHomeAssistantState[]> => {
				if (semaphore.value.fetching.items) {
					throw new DevicesHomeAssistantApiException('Already fetching Home Assistant states.');
				}

				semaphore.value.fetching.items = true;

				const { data: responseData, error, response } = await backend.client.GET(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/states`);

				semaphore.value.fetching.items = false;

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((states) => {
							const transformed = transformHomeAssistantStateResponse(states);

							return [transformed.entityId, transformed];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch Home Assistant states.';

				if (error) {
					errorReason = getErrorReason<operations['get-devices-home-assistant-plugin-states']>(error, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
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
			findById,
			set,
			unset,
			get,
			fetch,
		};
	}
);

export const registerHomeAssistantStatesStore = (
	pinia: Pinia
): Store<string, IHomeAssistantStatesStoreState, object, IHomeAssistantStatesStoreActions> => {
	return useHomeAssistantStates(pinia);
};
