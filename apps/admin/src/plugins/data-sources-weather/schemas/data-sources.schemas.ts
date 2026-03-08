import { z } from 'zod';

import { DataSourceAddFormSchema, DataSourceEditFormSchema } from '../../../modules/dashboard';
import { WeatherDataField } from '../data-sources-weather.constants';

export const CurrentWeatherDataSourceAddFormSchema = DataSourceAddFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
	field: z.enum(WeatherDataField),
	icon: z.string().nullable().optional(),
	unit: z.string().nullable().optional(),
});

export const CurrentWeatherDataSourceEditFormSchema = DataSourceEditFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
	field: z.enum(WeatherDataField).optional(),
	icon: z.string().nullable().optional(),
	unit: z.string().nullable().optional(),
});

export const ForecastDayDataSourceAddFormSchema = DataSourceAddFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
	dayOffset: z.number().min(0).max(7),
	field: z.enum(WeatherDataField),
	icon: z.string().nullable().optional(),
	unit: z.string().nullable().optional(),
});

export const ForecastDayDataSourceEditFormSchema = DataSourceEditFormSchema.extend({
	locationId: z.string().uuid().optional().nullable(),
	dayOffset: z.number().min(0).max(7).optional(),
	field: z.enum(WeatherDataField).optional(),
	icon: z.string().nullable().optional(),
	unit: z.string().nullable().optional(),
});
