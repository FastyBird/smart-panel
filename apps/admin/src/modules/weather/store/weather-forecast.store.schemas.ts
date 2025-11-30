import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiWeatherForecastDay = components['schemas']['WeatherModuleDataForecastDay'];

// STORE STATE
// ===========

export const WeatherForecastSchema = z.array(
	z.object({
		temperature: z.object({
			morn: z.number().nullable().optional(),
			day: z.number().nullable().optional(),
			eve: z.number().nullable().optional(),
			night: z.number().nullable().optional(),
			min: z.number().nullable().optional(),
			max: z.number().nullable().optional(),
		}),
		feelsLike: z.object({
			morn: z.number().nullable().optional(),
			day: z.number().nullable().optional(),
			eve: z.number().nullable().optional(),
			night: z.number().nullable().optional(),
		}),
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
		sunrise: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		sunset: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		moonrise: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		moonset: z
			.union([z.string().datetime({ offset: true }), z.date()])
			.transform((date) => (date instanceof Date ? date : new Date(date)))
			.optional()
			.nullable()
			.default(null),
		dayTime: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	})
);

export const WeatherForecastStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const WeatherForecastOnEventActionPayloadSchema = z.object({
	data: z.array(z.object({})),
});

export const WeatherForecastSetActionPayloadSchema = z.object({
	data: z.array(
		z.object({
			temperature: z.object({
				morn: z.number().nullable().optional(),
				day: z.number().nullable().optional(),
				eve: z.number().nullable().optional(),
				night: z.number().nullable().optional(),
				min: z.number().nullable().optional(),
				max: z.number().nullable().optional(),
			}),
			feelsLike: z.object({
				morn: z.number().nullable().optional(),
				day: z.number().nullable().optional(),
				eve: z.number().nullable().optional(),
				night: z.number().nullable().optional(),
			}),
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
			sunrise: z
				.union([z.string().datetime({ offset: true }), z.date()])
				.transform((date) => (date instanceof Date ? date : new Date(date)))
				.optional()
				.nullable()
				.default(null),
			sunset: z
				.union([z.string().datetime({ offset: true }), z.date()])
				.transform((date) => (date instanceof Date ? date : new Date(date)))
				.optional()
				.nullable()
				.default(null),
			moonrise: z
				.union([z.string().datetime({ offset: true }), z.date()])
				.transform((date) => (date instanceof Date ? date : new Date(date)))
				.optional()
				.nullable()
				.default(null),
			moonset: z
				.union([z.string().datetime({ offset: true }), z.date()])
				.transform((date) => (date instanceof Date ? date : new Date(date)))
				.optional()
				.nullable()
				.default(null),
			dayTime: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
		})
	),
});

// BACKEND API
// ===========

export const WeatherForecastDayResSchema: ZodType<ApiWeatherForecastDay> = z.object({
	temperature: z.object({
		morn: z.number().nullable().optional(),
		day: z.number().nullable().optional(),
		eve: z.number().nullable().optional(),
		night: z.number().nullable().optional(),
		min: z.number().nullable().optional(),
		max: z.number().nullable().optional(),
	}),
	feels_like: z.object({
		morn: z.number().nullable().optional(),
		day: z.number().nullable().optional(),
		eve: z.number().nullable().optional(),
		night: z.number().nullable().optional(),
	}),
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
	sunrise: z.string().nullable().optional(),
	sunset: z.string().nullable().optional(),
	moonrise: z.string().nullable().optional(),
	moonset: z.string().nullable().optional(),
	day_time: z.string(),
});
