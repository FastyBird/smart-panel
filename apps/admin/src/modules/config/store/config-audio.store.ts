import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import { ConfigModuleAudioType, PathsConfigModuleConfigSectionGetParametersPathSection, type operations } from '../../../openapi';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigException, ConfigValidationException } from '../config.exceptions';

import { ConfigAudioEditActionPayloadSchema, ConfigAudioSchema } from './config-audio.store.schemas';
import type {
	ConfigAudioStoreSetup,
	IConfigAudio,
	IConfigAudioEditActionPayload,
	IConfigAudioOnEventActionPayload,
	IConfigAudioRes,
	IConfigAudioSetActionPayload,
	IConfigAudioStateSemaphore,
	IConfigAudioStoreActions,
	IConfigAudioStoreState,
} from './config-audio.store.types';
import { transformConfigAudioResponse, transformConfigAudioUpdateRequest } from './config-audio.transformers';

const defaultSemaphore: IConfigAudioStateSemaphore = {
	getting: false,
	updating: false,
};

export const useConfigAudio = defineStore<'config_module-config_audio', ConfigAudioStoreSetup>(
	'config_module-config_audio',
	(): ConfigAudioStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IConfigAudioStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IConfigAudio | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IConfigAudio> | null = null;

		const onEvent = (payload: IConfigAudioOnEventActionPayload): IConfigAudio => {
			return set({
				data: transformConfigAudioResponse(payload.data as unknown as IConfigAudioRes),
			});
		};

		const set = (payload: IConfigAudioSetActionPayload): IConfigAudio => {
			const parsedConfigAudio = ConfigAudioSchema.safeParse({ ...payload.data, type: ConfigModuleAudioType.audio });

			if (!parsedConfigAudio.success) {
				console.error('Schema validation failed with:', parsedConfigAudio.error);

				throw new ConfigValidationException('Failed to insert audio config.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedConfigAudio.data);
		};

		const get = async (): Promise<IConfigAudio> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IConfigAudio> => {
				if (semaphore.value.getting) {
					throw new ConfigApiException('Already getting audio config.');
				}

				semaphore.value.getting = true;

				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
					params: {
						path: {
							section: PathsConfigModuleConfigSectionGetParametersPathSection.audio,
						},
					},
				});

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = false;

				if (typeof responseData !== 'undefined') {
					data.value = transformConfigAudioResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch audio config.';

				if (error) {
					errorReason = getErrorReason<operations['get-config-module-config-section']>(error, errorReason);
				}

				throw new ConfigApiException(errorReason, response.status);
			})();

			pendingGetPromises = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingGetPromises = null;
			}
		};

		const edit = async (payload: IConfigAudioEditActionPayload): Promise<IConfigAudio> => {
			const parsedPayload = ConfigAudioEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new ConfigValidationException('Failed to edit audio config.');
			}

			if (semaphore.value.updating) {
				throw new ConfigException('Audio config is already being updated.');
			}

			const parsedEditedConfig = ConfigAudioSchema.safeParse({
				...data.value,
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedConfig.success) {
				console.error('Schema validation failed with:', parsedEditedConfig.error);

				throw new ConfigValidationException('Failed to edit audio config.');
			}

			semaphore.value.updating = true;

			data.value = parsedEditedConfig.data;

			const apiResponse = await backend.client.PATCH(`/${CONFIG_MODULE_PREFIX}/config/{section}`, {
				params: {
					path: {
						section: PathsConfigModuleConfigSectionGetParametersPathSection.audio,
					},
				},
				body: {
					data: transformConfigAudioUpdateRequest(parsedEditedConfig.data),
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = false;

			if (typeof responseData !== 'undefined') {
				data.value = transformConfigAudioResponse(responseData.data);

				return data.value;
			}

			// Updating the record on api failed, we need to refresh the record
			await get();

			let errorReason: string | null = 'Failed to update audio config.';

			if (error) {
				errorReason = getErrorReason<operations['update-config-module-config-section']>(error, errorReason);
			}

			throw new ConfigApiException(errorReason, response.status);
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

export const registerConfigAudioStore = (pinia: Pinia): Store<string, IConfigAudioStoreState, object, IConfigAudioStoreActions> => {
	return useConfigAudio(pinia);
};
