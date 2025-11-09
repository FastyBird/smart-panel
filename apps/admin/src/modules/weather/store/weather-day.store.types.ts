import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	WeatherDayOnEventActionPayloadSchema,
	WeatherDayResSchema,
	type WeatherDaySchema,
	WeatherDaySetActionPayloadSchema,
	WeatherDayStateSemaphoreSchema,
} from './weather-day.store.schemas';

// STORE STATE
// ===========

export type IWeatherDay = z.infer<typeof WeatherDaySchema>;

export type IWeatherDayStateSemaphore = z.infer<typeof WeatherDayStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IWeatherDayOnEventActionPayload = z.infer<typeof WeatherDayOnEventActionPayloadSchema>;

export type IWeatherDaySetActionPayload = z.infer<typeof WeatherDaySetActionPayloadSchema>;

// STORE
// =====

export interface IWeatherDayStoreState {
	data: Ref<IWeatherDay | null>;
	semaphore: Ref<IWeatherDayStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IWeatherDayStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IWeatherDayOnEventActionPayload) => IWeatherDay;
	set: (payload: IWeatherDaySetActionPayload) => IWeatherDay;
	get: () => Promise<IWeatherDay>;
}

export type WeatherDayStoreSetup = IWeatherDayStoreState & IWeatherDayStoreActions;

// BACKEND API
// ===========

export type IWeatherDayRes = z.infer<typeof WeatherDayResSchema>;

// STORE
export type WeatherDayStore = Store<string, IWeatherDayStoreState, object, IWeatherDayStoreActions>;
