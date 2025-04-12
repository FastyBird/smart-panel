import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { DashboardDayWeatherTileType, DashboardForecastWeatherTileType, type components } from '../../../openapi';

type ApiCreateDayWeatherTile = components['schemas']['DashboardCreateDayWeatherTile'];
type ApiCreateForecastWeatherTile = components['schemas']['DashboardCreateForecastWeatherTile'];
type ApiUpdateDayWeatherTile = components['schemas']['DashboardUpdateDayWeatherTile'];
type ApiUpdateForecastWeatherTile = components['schemas']['DashboardUpdateForecastWeatherTile'];
type ApiDayWeatherTile = components['schemas']['DashboardDayWeatherTile'];
type ApiForecastWeatherTile = components['schemas']['DashboardForecastWeatherTile'];

// STORE STATE
// ===========

export const DayWeatherTileSchema = TileSchema.extend({});

export const ForecastWeatherTileSchema = TileSchema.extend({});

// BACKEND API
// ===========

export const DayWeatherTileCreateReqSchema: ZodType<ApiCreateDayWeatherTile> = TileCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const ForecastWeatherTileCreateReqSchema: ZodType<ApiCreateForecastWeatherTile> = TileCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);

export const DayWeatherTileResSchema: ZodType<ApiDayWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDayWeatherTileType),
	})
);

export const ForecastWeatherTileResSchema: ZodType<ApiForecastWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardForecastWeatherTileType),
	})
);
