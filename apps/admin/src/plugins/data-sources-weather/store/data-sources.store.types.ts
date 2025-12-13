import { z } from 'zod';

import {
	CurrentWeatherDataSourceCreateReqSchema,
	CurrentWeatherDataSourceResSchema,
	CurrentWeatherDataSourceSchema,
	CurrentWeatherDataSourceUpdateReqSchema,
	ForecastDayDataSourceCreateReqSchema,
	ForecastDayDataSourceResSchema,
	ForecastDayDataSourceSchema,
	ForecastDayDataSourceUpdateReqSchema,
} from './data-sources.store.schemas';

// STORE STATE
// ===========

export type ICurrentWeatherDataSource = z.infer<typeof CurrentWeatherDataSourceSchema>;

export type IForecastDayDataSource = z.infer<typeof ForecastDayDataSourceSchema>;

// BACKEND API
// ===========

export type ICurrentWeatherDataSourceCreateReq = z.infer<typeof CurrentWeatherDataSourceCreateReqSchema>;

export type ICurrentWeatherDataSourceUpdateReq = z.infer<typeof CurrentWeatherDataSourceUpdateReqSchema>;

export type ICurrentWeatherDataSourceRes = z.infer<typeof CurrentWeatherDataSourceResSchema>;

export type IForecastDayDataSourceCreateReq = z.infer<typeof ForecastDayDataSourceCreateReqSchema>;

export type IForecastDayDataSourceUpdateReq = z.infer<typeof ForecastDayDataSourceUpdateReqSchema>;

export type IForecastDayDataSourceRes = z.infer<typeof ForecastDayDataSourceResSchema>;
