import { type ZodType, z } from 'zod';

import type { WeatherModuleForecastHourSchema } from '../../../openapi.constants';

type ApiForecastHour = WeatherModuleForecastHourSchema;

// STORE STATE
// ===========

export const WeatherHourlyForecastSchema = z.array(
	z.object({
		temperature: z.number(),
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
		rain: z.number().nullable().default(null),
		snow: z.number().nullable().default(null),
		dateTime: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	})
);

// BACKEND API
// ===========

export const WeatherForecastHourResSchema: ZodType<ApiForecastHour> = z.object({
	temperature: z.number(),
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
	rain: z.number().nullable().optional(),
	snow: z.number().nullable().optional(),
	date_time: z.string(),
});
