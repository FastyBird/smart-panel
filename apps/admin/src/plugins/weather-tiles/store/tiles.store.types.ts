import { z } from 'zod';

import {
	DayWeatherTileCreateReqSchema,
	DayWeatherTileResSchema,
	DayWeatherTileSchema,
	DayWeatherTileUpdateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	ForecastWeatherTileResSchema,
	ForecastWeatherTileSchema,
	ForecastWeatherTileUpdateReqSchema,
} from './tiles.store.schemas';

// STORE STATE
// ===========

export type IDayWeatherTile = z.infer<typeof DayWeatherTileSchema>;

export type IForecastWeatherTile = z.infer<typeof ForecastWeatherTileSchema>;

// BACKEND API
// ===========

export type IDayWeatherTileCreateReq = z.infer<typeof DayWeatherTileCreateReqSchema>;

export type IForecastWeatherTileCreateReq = z.infer<typeof ForecastWeatherTileCreateReqSchema>;

export type IDayWeatherTileUpdateReq = z.infer<typeof DayWeatherTileUpdateReqSchema>;

export type IForecastWeatherTileUpdateReq = z.infer<typeof ForecastWeatherTileUpdateReqSchema>;

export type IDayWeatherTileRes = z.infer<typeof DayWeatherTileResSchema>;

export type IForecastWeatherTileRes = z.infer<typeof ForecastWeatherTileResSchema>;
