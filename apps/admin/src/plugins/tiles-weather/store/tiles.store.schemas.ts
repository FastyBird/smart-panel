import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { TilesWeatherPluginDayWeatherTileType, TilesWeatherPluginForecastWeatherTileType, type components } from '../../../openapi';

type ApiCreateDayWeatherTile = components['schemas']['TilesWeatherPluginCreateDayWeatherTile'];
type ApiCreateForecastWeatherTile = components['schemas']['TilesWeatherPluginCreateForecastWeatherTile'];
type ApiUpdateDayWeatherTile = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
type ApiUpdateForecastWeatherTile = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];
type ApiDayWeatherTile = components['schemas']['TilesWeatherPluginDayWeatherTile'];
type ApiForecastWeatherTile = components['schemas']['TilesWeatherPluginForecastWeatherTile'];

// STORE STATE
// ===========

export const DayWeatherTileSchema = TileSchema.extend({});

export const ForecastWeatherTileSchema = TileSchema.extend({});

// BACKEND API
// ===========

export const DayWeatherTileCreateReqSchema: ZodType<ApiCreateDayWeatherTile & { parent: { type: string; id: string } }> = TileCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(TilesWeatherPluginDayWeatherTileType),
	})
);

export const ForecastWeatherTileCreateReqSchema: ZodType<ApiCreateForecastWeatherTile & { parent: { type: string; id: string } }> =
	TileCreateReqSchema.and(
		z.object({
			type: z.nativeEnum(TilesWeatherPluginForecastWeatherTileType),
		})
	);

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(TilesWeatherPluginDayWeatherTileType),
	})
);

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(TilesWeatherPluginForecastWeatherTileType),
	})
);

export const DayWeatherTileResSchema: ZodType<ApiDayWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(TilesWeatherPluginDayWeatherTileType),
	})
);

export const ForecastWeatherTileResSchema: ZodType<ApiForecastWeatherTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(TilesWeatherPluginForecastWeatherTileType),
	})
);
