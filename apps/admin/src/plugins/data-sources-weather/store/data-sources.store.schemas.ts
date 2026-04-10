import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	DataSourceSchema,
	DataSourceUpdateReqSchema,
} from '../../../modules/dashboard';
import type {
	DataSourcesWeatherPluginCurrentWeatherDataSourceSchema,
	DataSourcesWeatherPluginForecastDayDataSourceSchema,
} from '../../../openapi.constants';
import { WeatherDataSourceField } from '../../../openapi.constants';
import {
	DATA_SOURCES_WEATHER_CURRENT_TYPE,
	DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	WeatherDataField,
} from '../data-sources-weather.constants';

type ApiCurrentWeatherDataSource = DataSourcesWeatherPluginCurrentWeatherDataSourceSchema;
type ApiForecastDayDataSource = DataSourcesWeatherPluginForecastDayDataSourceSchema;

// STORE STATE
// ===========

export const CurrentWeatherDataSourceSchema = DataSourceSchema.extend({
	locationId: z.string().uuid().optional().nullable().default(null),
	field: z.nativeEnum(WeatherDataField).default(WeatherDataField.TEMPERATURE),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	unit: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

export const ForecastDayDataSourceSchema = DataSourceSchema.extend({
	locationId: z.string().uuid().optional().nullable().default(null),
	dayOffset: z.number().min(0).max(7).default(1),
	field: z.nativeEnum(WeatherDataField).default(WeatherDataField.TEMPERATURE_MAX),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	unit: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

// BACKEND API
// ===========

export const CurrentWeatherDataSourceCreateReqSchema = DataSourceCreateReqSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_CURRENT_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		field: z.nativeEnum(WeatherDataField),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		unit: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const CurrentWeatherDataSourceUpdateReqSchema = DataSourceUpdateReqSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_CURRENT_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		field: z.nativeEnum(WeatherDataField).optional(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		unit: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const CurrentWeatherDataSourceResSchema: ZodType<ApiCurrentWeatherDataSource> = DataSourceResSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_CURRENT_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		field: z.nativeEnum(WeatherDataSourceField),
		icon: z.string().nullable(),
		unit: z.string().nullable(),
	})
);

export const ForecastDayDataSourceCreateReqSchema = DataSourceCreateReqSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		day_offset: z.number().min(0).max(7),
		field: z.nativeEnum(WeatherDataField),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		unit: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const ForecastDayDataSourceUpdateReqSchema = DataSourceUpdateReqSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		day_offset: z.number().min(0).max(7).optional(),
		field: z.nativeEnum(WeatherDataField).optional(),
		icon: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
		unit: z
			.string()
			.trim()
			.transform((val) => (val === '' ? null : val))
			.nullable()
			.optional(),
	})
);

export const ForecastDayDataSourceResSchema: ZodType<ApiForecastDayDataSource> = DataSourceResSchema.and(
	z.object({
		type: z.literal(DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE),
		location_id: z.string().uuid().optional().nullable(),
		day_offset: z.number().min(0).max(7),
		field: z.nativeEnum(WeatherDataSourceField),
		icon: z.string().nullable(),
		unit: z.string().nullable(),
	})
);
