import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend, useLogger } from '../../../common';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantDiscoveredHelperSchema } from './home-assistant-discovered-helpers.store.schemas';
import type {
	HomeAssistantDiscoveredHelpersStoreSetup,
	IHomeAssistantDiscoveredHelper,
	IHomeAssistantDiscoveredHelpersGetActionPayload,
	IHomeAssistantDiscoveredHelpersSetActionPayload,
	IHomeAssistantDiscoveredHelpersStateSemaphore,
	IHomeAssistantDiscoveredHelpersStoreActions,
	IHomeAssistantDiscoveredHelpersStoreState,
	IHomeAssistantDiscoveredHelpersUnsetActionPayload,
} from './home-assistant-discovered-helpers.store.types';
import { transformHomeAssistantDiscoveredHelperResponse } from './home-assistant-discovered-helpers.transformers';
import type { IHomeAssistantStateRes } from './home-assistant-states.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';
import { statesStoreKey } from './keys';

const defaultSemaphore: IHomeAssistantDiscoveredHelpersStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
};

export const useHomeAssistantDiscoveredHelpers = defineStore<
	'devices_home_assistant_plugin-discovered_helpers',
	HomeAssistantDiscoveredHelpersStoreSetup
>('devices_home_assistant_plugin-discovered_helpers', (): HomeAssistantDiscoveredHelpersStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const storesManager = injectStoresManager();

	const semaphore = ref<IHomeAssistantDiscoveredHelpersStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IHomeAssistantDiscoveredHelper['entityId']]: IHomeAssistantDiscoveredHelper }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (entityId: IHomeAssistantDiscoveredHelper['entityId']): boolean => semaphore.value.fetching.item.includes(entityId);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IHomeAssistantDiscoveredHelper[] => Object.values(data.value);

	const findByEntityId = (entityId: IHomeAssistantDiscoveredHelper['entityId']): IHomeAssistantDiscoveredHelper | null =>
		data.value[entityId] ?? null;

	const pendingGetPromises: Record<string, Promise<IHomeAssistantDiscoveredHelper>> = {};

	const pendingFetchPromises: Record<string, Promise<IHomeAssistantDiscoveredHelper[]>> = {};

	const set = (payload: IHomeAssistantDiscoveredHelpersSetActionPayload): IHomeAssistantDiscoveredHelper => {
		if (payload.entityId && data.value && payload.entityId in data.value) {
			const parsedHelper = HomeAssistantDiscoveredHelperSchema.safeParse({ ...data.value[payload.entityId], ...payload.data });

			if (!parsedHelper.success) {
				logger.error('Schema validation failed with:', parsedHelper.error);

				throw new DevicesHomeAssistantValidationException('Failed to insert HomeAssistantDiscoveredHelper.');
			}

			return (data.value[parsedHelper.data.entityId] = parsedHelper.data);
		}

		const parsedHelper = HomeAssistantDiscoveredHelperSchema.safeParse({ ...payload.data, entityId: payload.entityId });

		if (!parsedHelper.success) {
			logger.error('Schema validation failed with:', parsedHelper.error);

			throw new DevicesHomeAssistantValidationException('Failed to insert Home Assistant helper.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedHelper.data.entityId] = parsedHelper.data);
	};

	const unset = (payload: IHomeAssistantDiscoveredHelpersUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.entityId];
	};

	const get = async (payload: IHomeAssistantDiscoveredHelpersGetActionPayload): Promise<IHomeAssistantDiscoveredHelper> => {
		const existingPromise = pendingGetPromises[payload.entityId];
		if (existingPromise) {
			return existingPromise;
		}

		const fetchPromise = (async (): Promise<IHomeAssistantDiscoveredHelper> => {
			if (semaphore.value.fetching.item.includes(payload.entityId)) {
				throw new DevicesHomeAssistantApiException('Already fetching HomeAssistantDiscoveredHelper.');
			}

			semaphore.value.fetching.item.push(payload.entityId);

			try {
				const apiResponse = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-helpers/{entityId}`, {
					params: {
						path: { entityId: payload.entityId },
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const transformed = transformHomeAssistantDiscoveredHelperResponse(responseData.data);

					data.value[transformed.entityId] = transformed;

					if (responseData.data.state) {
						insertStateRelation(responseData.data.state);
					}

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch HomeAssistantDiscoveredHelper.';

				if (error) {
					errorReason = (error as { error?: { message?: string } })?.error?.message ?? errorReason;
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.entityId);
			}
		})();

		pendingGetPromises[payload.entityId] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingGetPromises[payload.entityId];
		}
	};

	const fetch = async (): Promise<IHomeAssistantDiscoveredHelper[]> => {
		const existingPromise = pendingFetchPromises['all'];
		if (existingPromise) {
			return existingPromise;
		}

		const fetchPromise = (async (): Promise<IHomeAssistantDiscoveredHelper[]> => {
			if (semaphore.value.fetching.items) {
				throw new DevicesHomeAssistantApiException('Already fetching Home Assistant helpers.');
			}

			semaphore.value.fetching.items = true;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-helpers`);

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((helper) => {
							const transformed = transformHomeAssistantDiscoveredHelperResponse(helper);

							if (helper.state) {
								insertStateRelation(helper.state);
							}

							return [transformed.entityId, transformed];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch Home Assistant helpers.';

				if (error) {
					errorReason = (error as { error?: { message?: string } })?.error?.message ?? errorReason;
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
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

	const insertStateRelation = (state: IHomeAssistantStateRes): void => {
		const statesStore = storesManager.getStore(statesStoreKey);

		statesStore.set({
			entityId: state.entity_id,
			data: transformHomeAssistantStateResponse(state),
		});
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findByEntityId,
		set,
		unset,
		get,
		fetch,
	};
});

export const registerHomeAssistantDiscoveredHelpersStore = (
	pinia: Pinia
): Store<string, IHomeAssistantDiscoveredHelpersStoreState, object, IHomeAssistantDiscoveredHelpersStoreActions> => {
	return useHomeAssistantDiscoveredHelpers(pinia);
};
