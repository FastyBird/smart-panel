import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import {
	ConfigWeatherType,
	ConfigWeatherUnit,
	PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type,
	type components,
} from '../../../openapi';

type ApiConfigWeather = components['schemas']['ConfigWeather'];
type ApiConfigUpdateWeather = components['schemas']['ConfigUpdateWeather'];

// STORE STATE
// ===========

export const ConfigWeatherSchema = z.object({
	type: z.nativeEnum(ConfigWeatherType),
	location: z.string().nullable(),
	locationType: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
	unit: z.nativeEnum(ConfigWeatherUnit),
	openWeatherApiKey: z.string().nullable(),
});
export type IConfigWeather = z.infer<typeof ConfigWeatherSchema>;

export const ConfigWeatherStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});
export type IConfigWeatherStateSemaphore = z.infer<typeof ConfigWeatherStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ConfigWeatherSetActionPayloadSchema = z.object({
	data: z.object({
		type: z.nativeEnum(ConfigWeatherType),
		location: z.string().nullable(),
		location_type: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
		unit: z.nativeEnum(ConfigWeatherUnit),
		open_weather_api_key: z.string().nullable(),
	}),
});
export type IConfigWeatherSetActionPayload = z.infer<typeof ConfigWeatherSetActionPayloadSchema>;

export const ConfigWeatherEditActionPayloadSchema = z.object({
	data: z.object({
		location: z.string().nullable(),
		locationType: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
		unit: z.nativeEnum(ConfigWeatherUnit),
		openWeatherApiKey: z.string().nullable(),
	}),
});
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
	set: (payload: IConfigWeatherSetActionPayload) => IConfigWeather;
	get: () => Promise<IConfigWeather>;
	edit: (payload: IConfigWeatherEditActionPayload) => Promise<IConfigWeather>;
}

export type ConfigWeatherStoreSetup = IConfigWeatherStoreState & IConfigWeatherStoreActions;

// BACKEND API
// ===========

export const ConfigWeatherUpdateReqSchema: ZodType<ApiConfigUpdateWeather> = z.object({
	type: z.nativeEnum(ConfigWeatherType),
	location: z.string().nullable(),
	location_type: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
	unit: z.nativeEnum(ConfigWeatherUnit),
	open_weather_api_key: z.string().nullable(),
});
export type IConfigWeatherUpdateReq = z.infer<typeof ConfigWeatherUpdateReqSchema>;

export const ConfigWeatherResSchema: ZodType<ApiConfigWeather> = z.object({
	type: z.nativeEnum(ConfigWeatherType),
	location: z.string().nullable(),
	location_type: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
	unit: z.nativeEnum(ConfigWeatherUnit),
	open_weather_api_key: z.string().nullable(),
});
export type IConfigWeatherRes = z.infer<typeof ConfigWeatherResSchema>;

// STORE
export type ConfigWeatherStore = Store<string, IConfigWeatherStoreState, object, IConfigWeatherStoreActions>;
