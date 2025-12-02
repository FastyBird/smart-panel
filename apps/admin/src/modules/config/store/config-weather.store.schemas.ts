import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';
import {
	ConfigModuleWeatherCityIdLocationType,
	ConfigModuleWeatherCityNameLocationType,
	ConfigModuleWeatherLatLonLocationType,
	ConfigModuleWeatherLocationType,
	ConfigModuleWeatherType,
	ConfigModuleWeatherUnit,
	ConfigModuleWeatherZipCodeLocationType,
} from '../../../openapi.constants';

type ApiConfigWeather = components['schemas']['ConfigModuleDataWeather'];
type ApiConfigWeatherLatLon = components['schemas']['ConfigModuleDataWeatherLatLon'];
type ApiConfigWeatherCityName = components['schemas']['ConfigModuleDataWeatherCityName'];
type ApiConfigWeatherCityId = components['schemas']['ConfigModuleDataWeatherCityId'];
type ApiConfigWeatherZipCode = components['schemas']['ConfigModuleDataWeatherZipCode'];
type ApiConfigUpdateWeather = components['schemas']['ConfigModuleUpdateWeather'];
type ApiConfigUpdateWeatherLatLon = components['schemas']['ConfigModuleUpdateWeatherLatLon'];
type ApiConfigUpdateWeatherCityName = components['schemas']['ConfigModuleUpdateWeatherCityName'];
type ApiConfigUpdateWeatherCityId = components['schemas']['ConfigModuleUpdateWeatherCityId'];
type ApiConfigUpdateWeatherZipCode = components['schemas']['ConfigModuleUpdateWeatherZipCode'];

// STORE STATE
// ===========

export const ConfigWeatherSchema = z.object({
	type: z.nativeEnum(ConfigModuleWeatherType),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
	cityId: z.number().nullable().optional(),
	cityName: z.string().nullable().optional(),
	zipCode: z.string().nullable().optional(),
	locationType: z.union([
		z.nativeEnum(ConfigModuleWeatherLatLonLocationType),
		z.nativeEnum(ConfigModuleWeatherCityNameLocationType),
		z.nativeEnum(ConfigModuleWeatherCityIdLocationType),
		z.nativeEnum(ConfigModuleWeatherZipCodeLocationType),
	]),
	unit: z.nativeEnum(ConfigModuleWeatherUnit),
	openWeatherApiKey: z.string().nullable(),
});

export const ConfigWeatherStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigWeatherOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ConfigWeatherSetActionPayloadSchema = z.object({
	data: z.object({
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
		cityId: z.number().nullable().optional(),
		cityName: z.string().nullable().optional(),
		zipCode: z.string().nullable().optional(),
		locationType: z.union([
			z.nativeEnum(ConfigModuleWeatherLatLonLocationType),
			z.nativeEnum(ConfigModuleWeatherCityNameLocationType),
			z.nativeEnum(ConfigModuleWeatherCityIdLocationType),
			z.nativeEnum(ConfigModuleWeatherZipCodeLocationType),
		]),
		unit: z.nativeEnum(ConfigModuleWeatherUnit),
		openWeatherApiKey: z.string().nullable(),
	}),
});

export const ConfigWeatherEditActionPayloadSchema = z.object({
	data: z.object({
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
		cityId: z.number().nullable().optional(),
		cityName: z.string().nullable().optional(),
		zipCode: z.string().nullable().optional(),
		locationType: z.union([
			z.nativeEnum(ConfigModuleWeatherLatLonLocationType),
			z.nativeEnum(ConfigModuleWeatherCityNameLocationType),
			z.nativeEnum(ConfigModuleWeatherCityIdLocationType),
			z.nativeEnum(ConfigModuleWeatherZipCodeLocationType),
		]),
		unit: z.nativeEnum(ConfigModuleWeatherUnit),
		openWeatherApiKey: z.string().nullable(),
	}),
});

// BACKEND API
// ===========

export const ConfigWeatherBaseUpdateReqSchema: ZodType<ApiConfigUpdateWeather> = z.object({
	type: z.nativeEnum(ConfigModuleWeatherType),
	location_type: z.nativeEnum(ConfigModuleWeatherLocationType).optional(),
	unit: z.nativeEnum(ConfigModuleWeatherUnit).optional(),
	open_weather_api_key: z.string().nullable().optional(),
});

export const ConfigWeatherLatLonUpdateReqSchema: ZodType<ApiConfigUpdateWeatherLatLon> = ConfigWeatherBaseUpdateReqSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherLatLonLocationType),
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
	})
);

export const ConfigWeatherCityNameUpdateReqSchema: ZodType<ApiConfigUpdateWeatherCityName> = ConfigWeatherBaseUpdateReqSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherCityNameLocationType),
		city_name: z.string().nullable().optional(),
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
	})
);

export const ConfigWeatherCityIdUpdateReqSchema: ZodType<ApiConfigUpdateWeatherCityId> = ConfigWeatherBaseUpdateReqSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherCityIdLocationType),
		city_id: z.number().nullable().optional(),
	})
);

export const ConfigWeatherZipCodeUpdateReqSchema: ZodType<ApiConfigUpdateWeatherZipCode> = ConfigWeatherBaseUpdateReqSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherZipCodeLocationType),
		zip_code: z.string().nullable().optional(),
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
	})
);

export const ConfigWeatherBaseResSchema: ZodType<ApiConfigWeather> = z.object({
	type: z.nativeEnum(ConfigModuleWeatherType),
	location_type: z.nativeEnum(ConfigModuleWeatherLocationType),
	unit: z.nativeEnum(ConfigModuleWeatherUnit),
	open_weather_api_key: z.string().nullable(),
});

export const ConfigWeatherLatLonResSchema: ZodType<ApiConfigWeatherLatLon> = ConfigWeatherBaseResSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherLatLonLocationType),
		latitude: z.number().nullable(),
		longitude: z.number().nullable(),
	})
);

export const ConfigWeatherCityNameResSchema: ZodType<ApiConfigWeatherCityName> = ConfigWeatherBaseResSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherCityNameLocationType),
		city_name: z.string().nullable(),
		latitude: z.number().nullable(),
		longitude: z.number().nullable(),
	})
);

export const ConfigWeatherCityIdResSchema: ZodType<ApiConfigWeatherCityId> = ConfigWeatherBaseResSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherCityIdLocationType),
		city_id: z.number().nullable(),
	})
);

export const ConfigWeatherZipCodeResSchema: ZodType<ApiConfigWeatherZipCode> = ConfigWeatherBaseResSchema.and(
	z.object({
		location_type: z.nativeEnum(ConfigModuleWeatherZipCodeLocationType),
		zip_code: z.string().nullable(),
		latitude: z.number().nullable(),
		longitude: z.number().nullable(),
	})
);
