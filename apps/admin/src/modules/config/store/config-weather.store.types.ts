import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ConfigWeatherBaseResSchema,
	ConfigWeatherBaseUpdateReqSchema,
	ConfigWeatherCityIdResSchema,
	ConfigWeatherCityNameResSchema,
	ConfigWeatherEditActionPayloadSchema,
	ConfigWeatherLatLonResSchema,
	ConfigWeatherOnEventActionPayloadSchema,
	ConfigWeatherSchema,
	ConfigWeatherSetActionPayloadSchema,
	ConfigWeatherStateSemaphoreSchema,
	ConfigWeatherZipCodeResSchema,
} from './config-weather.store.schemas';

// STORE STATE
// ===========

export type IConfigWeather = z.infer<typeof ConfigWeatherSchema>;

export type IConfigWeatherStateSemaphore = z.infer<typeof ConfigWeatherStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IConfigWeatherOnEventActionPayload = z.infer<typeof ConfigWeatherOnEventActionPayloadSchema>;

export type IConfigWeatherSetActionPayload = z.infer<typeof ConfigWeatherSetActionPayloadSchema>;

export type IConfigWeatherEditActionPayload = z.infer<typeof ConfigWeatherEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigWeatherStoreState {
	data: Ref<IConfigWeather | null>;
	semaphore: Ref<IConfigWeatherStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigWeatherStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IConfigWeatherOnEventActionPayload) => IConfigWeather;
	set: (payload: IConfigWeatherSetActionPayload) => IConfigWeather;
	get: () => Promise<IConfigWeather>;
	edit: (payload: IConfigWeatherEditActionPayload) => Promise<IConfigWeather>;
}

export type ConfigWeatherStoreSetup = IConfigWeatherStoreState & IConfigWeatherStoreActions;

// BACKEND API
// ===========

export type IConfigWeatherUpdateReq = z.infer<typeof ConfigWeatherBaseUpdateReqSchema>;

export type IConfigWeatherRes =
	| z.infer<typeof ConfigWeatherBaseResSchema>
	| z.infer<typeof ConfigWeatherLatLonResSchema>
	| z.infer<typeof ConfigWeatherCityNameResSchema>
	| z.infer<typeof ConfigWeatherCityIdResSchema>
	| z.infer<typeof ConfigWeatherZipCodeResSchema>;

// STORE
export type ConfigWeatherStore = Store<string, IConfigWeatherStoreState, object, IConfigWeatherStoreActions>;
