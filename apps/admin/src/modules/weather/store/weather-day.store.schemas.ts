import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiWeatherCurrentDay = components['schemas']['WeatherModuleCurrentDay'];

// STORE STATE
// ===========

export const WeatherDaySchema = z.object({
	temperature: z.number(),
	temperatureMin: z.number().nullable(),
	temperatureMax: z.number().nullable(),
	feelsLike: z.number(),
	pressure: z.number(),
	humidity: z.number(),
	weather: z.object({
		code: z.number(),
		main: z.string(),
		description: z.string(),
		icon: z.string(),
	}),
	wind: z.object({
		speed: z.number(),
		deg: z.number(),
		gust: z.number().nullable(),
	}),
	clouds: z.number(),
	rain: z.number().nullable(),
	snow: z.number().nullable(),
	sunrise: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	sunset: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	dayTime: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
});

export const WeatherDayStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const WeatherDayOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const WeatherDaySetActionPayloadSchema = z.object({
	data: z.object({
		temperature: z.number(),
		temperatureMin: z.number().nullable(),
		temperatureMax: z.number().nullable(),
		feelsLike: z.number(),
		pressure: z.number(),
		humidity: z.number(),
		weather: z.object({
			code: z.number(),
			main: z.string(),
			description: z.string(),
			icon: z.string(),
		}),
		wind: z.object({
			speed: z.number(),
			deg: z.number(),
			gust: z.number().nullable(),
		}),
		clouds: z.number(),
		rain: z.number().nullable(),
		snow: z.number().nullable(),
		sunrise: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
		sunset: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
		dayTime: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	}),
});

// BACKEND API
// ===========

export const WeatherDayResSchema: ZodType<ApiWeatherCurrentDay> = z.object({
	temperature: z.number(),
	temperature_min: z.number().nullable().optional(),
	temperature_max: z.number().nullable().optional(),
	feels_like: z.number(),
	pressure: z.number(),
	humidity: z.number(),
	weather: z.object({
		code: z.number(),
		main: z.string(),
		description: z.string(),
		icon: z.string(),
	}),
	wind: z.object({
		speed: z.number(),
		deg: z.number(),
		gust: z.number().nullable(),
	}),
	clouds: z.number(),
	rain: z.number().nullable(),
	snow: z.number().nullable(),
	sunrise: z.string(),
	sunset: z.string(),
	day_time: z.string(),
});
