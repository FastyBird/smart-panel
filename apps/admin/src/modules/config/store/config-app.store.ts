import { computed, ref } from 'vue';

import { type Pinia, type Store, defineStore, storeToRefs } from 'pinia';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type { ConfigModuleGetConfigSectionOperation } from '../../../openapi.constants';
import { CONFIG_MODULE_PREFIX } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { ConfigAppSchema } from './config-app.store.schemas';
import type {
	ConfigAppStoreSetup,
	IConfigApp,
	IConfigAppOnEventActionPayload,
	IConfigAppRes,
	IConfigAppSetActionPayload,
	IConfigAppStateSemaphore,
	IConfigAppStoreActions,
	IConfigAppStoreState,
} from './config-app.store.types';
import { transformConfigAppResponse } from './config-app.transformers';
import {
	configAudioStoreKey,
	configDisplayStoreKey,
	configLanguageStoreKey,
	configPluginsStoreKey,
	configSystemStoreKey,
	configWeatherStoreKey,
} from './keys';

const defaultSemaphore: IConfigAppStateSemaphore = {
	getting: false,
};

export const useConfigApp = defineStore<'config-module_config_app', ConfigAppStoreSetup>('config-module_config_app', (): ConfigAppStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const storesManager = injectStoresManager();

	const semaphore = ref<IConfigAppStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const dataPartial = ref<Pick<IConfigApp, 'path'> | null>(null);

	const data = computed<IConfigApp | null>((): IConfigApp | null => {
		const configAudioStore = storesManager.getStore(configAudioStoreKey);
		const configDisplayStore = storesManager.getStore(configDisplayStoreKey);
		const configLanguageStore = storesManager.getStore(configLanguageStoreKey);
		const configSystemStore = storesManager.getStore(configSystemStoreKey);
		const configWeatherStore = storesManager.getStore(configWeatherStoreKey);
		const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

		const { data: audio } = storeToRefs(configAudioStore);
		const { data: display } = storeToRefs(configDisplayStore);
		const { data: language } = storeToRefs(configLanguageStore);
		const { data: system } = storeToRefs(configSystemStore);
		const { data: weather } = storeToRefs(configWeatherStore);
		const { data: plugins } = storeToRefs(configPluginsStore);

		// Display is now optional as it's managed by DisplaysModule
		if (dataPartial.value === null || audio.value === null || language.value === null || system.value === null || weather.value === null) {
			return null;
		}

		return {
			path: dataPartial.value.path,
			audio: audio.value,
			display: display.value ?? undefined,
			language: language.value,
			system: system.value,
			weather: weather.value,
			plugins: Object.values(plugins.value),
		};
	});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (): boolean => semaphore.value.getting;

	let pendingGetPromises: Promise<IConfigApp> | null = null;

	const onEvent = (payload: IConfigAppOnEventActionPayload): IConfigApp => {
		return set({
			data: transformConfigAppResponse(payload.data as unknown as IConfigAppRes),
		});
	};

	const set = (payload: IConfigAppSetActionPayload): IConfigApp => {
		const parsedConfigApp = ConfigAppSchema.safeParse(payload.data);

		if (!parsedConfigApp.success) {
			logger.error('Schema validation failed with:', parsedConfigApp.error);

			throw new ConfigValidationException('Failed to insert app config.');
		}

		const configAudioStore = storesManager.getStore(configAudioStoreKey);
		const configDisplayStore = storesManager.getStore(configDisplayStoreKey);
		const configLanguageStore = storesManager.getStore(configLanguageStoreKey);
		const configSystemStore = storesManager.getStore(configSystemStoreKey);
		const configWeatherStore = storesManager.getStore(configWeatherStoreKey);
		const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

		configAudioStore.set({
			data: parsedConfigApp.data.audio,
		});
		// Display is now managed by DisplaysModule, only set if provided
		if (parsedConfigApp.data.display) {
			configDisplayStore.set({
				data: parsedConfigApp.data.display,
			});
		}
		configLanguageStore.set({
			data: parsedConfigApp.data.language,
		});
		configSystemStore.set({
			data: parsedConfigApp.data.system,
		});
		configWeatherStore.set({
			data: parsedConfigApp.data.weather,
		});

		for (const plugin of parsedConfigApp.data.plugins) {
			configPluginsStore.set({
				data: plugin,
			});
		}

		dataPartial.value = {
			path: parsedConfigApp.data.path,
		};

		return parsedConfigApp.data;
	};

	const get = async (): Promise<IConfigApp> => {
		if (pendingGetPromises) {
			return pendingGetPromises;
		}

		const fetchPromise = (async (): Promise<IConfigApp> => {
			if (semaphore.value.getting) {
				throw new ConfigApiException('Already getting app config.');
			}

			semaphore.value.getting = true;

			try {
				const apiResponse = await backend.client.GET(`/${CONFIG_MODULE_PREFIX}/config`);

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const transformed = transformConfigAppResponse(responseData.data);

					const configAudioStore = storesManager.getStore(configAudioStoreKey);
					const configDisplayStore = storesManager.getStore(configDisplayStoreKey);
					const configLanguageStore = storesManager.getStore(configLanguageStoreKey);
					const configSystemStore = storesManager.getStore(configSystemStoreKey);
					const configWeatherStore = storesManager.getStore(configWeatherStoreKey);
					const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

					configAudioStore.set({
						data: transformed.audio,
					});
					// Display is now managed by DisplaysModule, only set if provided
					if (transformed.display) {
						configDisplayStore.set({
							data: transformed.display,
						});
					}
					configLanguageStore.set({
						data: transformed.language,
					});
					configSystemStore.set({
						data: transformed.system,
					});
					configWeatherStore.set({
						data: transformed.weather,
					});

					for (const plugin of transformed.plugins) {
						configPluginsStore.set({
							data: plugin,
						});
					}

					dataPartial.value = {
						path: transformed.path,
					};

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch app config.';

				if (error) {
					errorReason = getErrorReason<ConfigModuleGetConfigSectionOperation>(error, errorReason);
				}

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

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		onEvent,
		set,
		get,
	};
});

export const registerConfigAppStore = (pinia: Pinia): Store<string, IConfigAppStoreState, object, IConfigAppStoreActions> => {
	return useConfigApp(pinia);
};
