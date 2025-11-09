import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	WeatherForecastDayResSchema,
	WeatherForecastOnEventActionPayloadSchema,
	type WeatherForecastSchema,
	WeatherForecastSetActionPayloadSchema,
	WeatherForecastStateSemaphoreSchema,
} from './weather-forecast.store.schemas';

// STORE STATE
// ===========

export type IWeatherForecast = z.infer<typeof WeatherForecastSchema>;

export type IWeatherForecastStateSemaphore = z.infer<typeof WeatherForecastStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IWeatherForecastOnEventActionPayload = z.infer<typeof WeatherForecastOnEventActionPayloadSchema>;

export type IWeatherForecastSetActionPayload = z.infer<typeof WeatherForecastSetActionPayloadSchema>;

// STORE
// =====

export interface IWeatherForecastStoreState {
	data: Ref<IWeatherForecast | null>;
	semaphore: Ref<IWeatherForecastStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IWeatherForecastStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	onEvent: (payload: IWeatherForecastOnEventActionPayload) => IWeatherForecast;
	set: (payload: IWeatherForecastSetActionPayload) => IWeatherForecast;
	get: () => Promise<IWeatherForecast>;
}

export type WeatherForecastStoreSetup = IWeatherForecastStoreState & IWeatherForecastStoreActions;

// BACKEND API
// ===========

export type IWeatherForecastDayRes = z.infer<typeof WeatherForecastDayResSchema>;

// STORE
export type WeatherForecastStore = Store<string, IWeatherForecastStoreState, object, IWeatherForecastStoreActions>;
