import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { useBackend, useLogger } from '../../../common';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigDisplayEditActionPayloadSchema, ConfigDisplaySchema } from './config-display.store.schemas';
import type {
	ConfigDisplayStoreSetup,
	IConfigDisplay,
	IConfigDisplayEditActionPayload,
	IConfigDisplayOnEventActionPayload,
	IConfigDisplayRes,
	IConfigDisplaySetActionPayload,
	IConfigDisplayStateSemaphore,
	IConfigDisplayStoreActions,
	IConfigDisplayStoreState,
} from './config-display.store.types';
import { transformConfigDisplayResponse, transformConfigDisplayUpdateRequest } from './config-display.transformers';

// Display configuration is now managed via the DisplaysModule
const DISPLAYS_MODULE_PREFIX = 'displays-module';

const defaultSemaphore: IConfigDisplayStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigDisplay = defineStore<'config-module_config_display', ConfigDisplayStoreSetup>(
	'config-module_config_display',
	(): ConfigDisplayStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IConfigDisplayStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigDisplay | null>(null);

		const currentDisplayId = ref<string | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigDisplay> | null = null;

	const onEvent = (payload: IConfigDisplayOnEventActionPayload): IConfigDisplay => {
		return set({
			data: transformConfigDisplayResponse(payload.data as unknown as IConfigDisplayRes),
		});
	};

	const set = (payload: IConfigDisplaySetActionPayload): IConfigDisplay => {
		const parsedConfigDisplay = ConfigDisplaySchema.safeParse(payload.data);

		if (!parsedConfigDisplay.success) {
			logger.error('Schema validation failed with:', parsedConfigDisplay.error);

			throw new ConfigValidationException('Failed to insert display config.');
		}

		data.value = data.value ?? null;

		return (data.value = parsedConfigDisplay.data);
	};

	const get = async (): Promise<IConfigDisplay> => {
		if (pendingGetPromises) {
			return pendingGetPromises;
		}

		const fetchPromise = (async (): Promise<IConfigDisplay> => {
			if (semaphore.value.getting) {
				throw new ConfigApiException('Already getting display config.');
			}

			semaphore.value.getting = true;

			try {
				// Get the list of displays and use the first one (primary display)
				const apiResponse = await backend.client.GET(`/${DISPLAYS_MODULE_PREFIX}/displays`);

				const { data: responseData, response } = apiResponse;

				if (typeof responseData !== 'undefined' && responseData.data && responseData.data.length > 0) {
					const primaryDisplay = responseData.data[0];
					data.value = transformConfigDisplayResponse({
						dark_mode: primaryDisplay.dark_mode,
						brightness: primaryDisplay.brightness,
						screen_lock_duration: primaryDisplay.screen_lock_duration,
						screen_saver: primaryDisplay.screen_saver,
					});

					// Store the display ID for later updates
					currentDisplayId.value = primaryDisplay.id;

					return data.value;
				}

				const errorReason: string | null = 'Failed to fetch display config.';

				throw new ConfigApiException(errorReason, response.status);
			} finally {
				semaphore.value.getting = false;
			}
		})();

		pendingGetPromises = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			pendingGetPromises = null;
		}
	};

	const edit = async (payload: IConfigDisplayEditActionPayload): Promise<IConfigDisplay> => {
		const parsedPayload = ConfigDisplayEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new ConfigValidationException('Failed to edit display config.');
		}

		if (semaphore.value.updating) {
			throw new ConfigException('Display config is already being updated.');
		}

		if (!currentDisplayId.value) {
			throw new ConfigException('No display ID available. Please fetch display config first.');
		}

		const parsedEditedConfig = ConfigDisplaySchema.safeParse({
			...data.value,
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedConfig.success) {
			logger.error('Schema validation failed with:', parsedEditedConfig.error);

			throw new ConfigValidationException('Failed to edit display config.');
		}

		semaphore.value.updating = true;

		data.value = parsedEditedConfig.data;

		try {
			const apiResponse = await backend.client.PATCH(`/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
				params: {
					path: {
						id: currentDisplayId.value,
					},
				},
				body: {
					data: transformConfigDisplayUpdateRequest(parsedEditedConfig.data),
				},
			});

			const { data: responseData, response } = apiResponse;

			if (typeof responseData !== 'undefined') {
				data.value = transformConfigDisplayResponse({
					dark_mode: responseData.data.dark_mode,
					brightness: responseData.data.brightness,
					screen_lock_duration: responseData.data.screen_lock_duration,
					screen_saver: responseData.data.screen_saver,
				});

				return data.value;
			}

			// Updating the record on api failed, we need to refresh the record
			await get();

			const errorReason: string | null = 'Failed to update display config.';

			throw new ConfigApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = false;
		}
	};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			onEvent,
			set,
			get,
			edit,
		};
	}
);

export const registerConfigDisplayStore = (pinia: Pinia): Store<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions> => {
	return useConfigDisplay(pinia);
};
