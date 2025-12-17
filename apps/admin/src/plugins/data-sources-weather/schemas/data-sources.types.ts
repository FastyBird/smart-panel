import { z } from 'zod';

import {
	CurrentWeatherDataSourceAddFormSchema,
	CurrentWeatherDataSourceEditFormSchema,
	ForecastDayDataSourceAddFormSchema,
	ForecastDayDataSourceEditFormSchema,
} from './data-sources.schemas';

export type ICurrentWeatherDataSourceAddForm = z.infer<typeof CurrentWeatherDataSourceAddFormSchema>;

export type ICurrentWeatherDataSourceEditForm = z.infer<typeof CurrentWeatherDataSourceEditFormSchema>;

export type IForecastDayDataSourceAddForm = z.infer<typeof ForecastDayDataSourceAddFormSchema>;

export type IForecastDayDataSourceEditForm = z.infer<typeof ForecastDayDataSourceEditFormSchema>;
