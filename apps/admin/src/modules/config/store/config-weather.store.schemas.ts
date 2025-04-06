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

export const ConfigWeatherStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigWeatherSetActionPayloadSchema = z.object({
	data: z.object({
		location: z.string().nullable(),
		locationType: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
		unit: z.nativeEnum(ConfigWeatherUnit),
		openWeatherApiKey: z.string().nullable(),
	}),
});

export const ConfigWeatherEditActionPayloadSchema = z.object({
	data: z.object({
		location: z.string().nullable(),
		locationType: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
		unit: z.nativeEnum(ConfigWeatherUnit),
		openWeatherApiKey: z.string().nullable(),
	}),
});

// BACKEND API
// ===========

export const ConfigWeatherUpdateReqSchema: ZodType<ApiConfigUpdateWeather> = z.object({
	type: z.nativeEnum(ConfigWeatherType),
	location: z.string().nullable(),
	location_type: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
	unit: z.nativeEnum(ConfigWeatherUnit),
	open_weather_api_key: z.string().nullable(),
});

export const ConfigWeatherResSchema: ZodType<ApiConfigWeather> = z.object({
	type: z.nativeEnum(ConfigWeatherType),
	location: z.string().nullable(),
	location_type: z.nativeEnum(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type),
	unit: z.nativeEnum(ConfigWeatherUnit),
	open_weather_api_key: z.string().nullable(),
});
