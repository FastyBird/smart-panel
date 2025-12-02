import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import type {
	TilesWeatherPluginCreateDayWeatherTileSchema,
	TilesWeatherPluginCreateForecastWeatherTileSchema,
	TilesWeatherPluginUpdateDayWeatherTileSchema,
	TilesWeatherPluginUpdateForecastWeatherTileSchema,
	TilesWeatherPluginDayWeatherTileSchema,
	TilesWeatherPluginForecastWeatherTileSchema,
} from '../../../openapi.constants';
import { TILES_WEATHER_PLUGIN_DAY_TYPE, TILES_WEATHER_PLUGIN_FORECAST_TYPE } from '../tiles-weather.constants';

type ApiCreateDayWeatherTile = TilesWeatherPluginCreateDayWeatherTileSchema;
type ApiCreateForecastWeatherTile = TilesWeatherPluginCreateForecastWeatherTileSchema;
type ApiUpdateDayWeatherTile = TilesWeatherPluginUpdateDayWeatherTileSchema;
type ApiUpdateForecastWeatherTile = TilesWeatherPluginUpdateForecastWeatherTileSchema;
type ApiDayWeatherTile = TilesWeatherPluginDayWeatherTileSchema;
type ApiForecastWeatherTile = TilesWeatherPluginForecastWeatherTileSchema;

// STORE STATE
// ===========

export const DayWeatherTileSchema = TileSchema.extend({});

export const ForecastWeatherTileSchema = TileSchema.extend({});

// BACKEND API
// ===========

export const DayWeatherTileCreateReqSchema: ZodType<ApiCreateDayWeatherTile & { parent: { type: string; id: string } }> = TileCreateReqSchema.and(
	z.object({
		type: z.literal(TILES_WEATHER_PLUGIN_DAY_TYPE),
	})
);

export const ForecastWeatherTileCreateReqSchema: ZodType<ApiCreateForecastWeatherTile & { parent: { type: string; id: string } }> =
	TileCreateReqSchema.and(
		z.object({
			type: z.literal(TILES_WEATHER_PLUGIN_FORECAST_TYPE),
		})
	);

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile & { parent: { type: string; id: string } }> = TileUpdateReqSchema.and(
	z.object({
		type: z.literal(TILES_WEATHER_PLUGIN_DAY_TYPE),
	})
);

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile & { parent: { type: string; id: string } }> =
	TileUpdateReqSchema.and(
		z.object({
			type: z.literal(TILES_WEATHER_PLUGIN_FORECAST_TYPE),
		})
	);

export const DayWeatherTileResSchema: ZodType<ApiDayWeatherTile> = TileResSchema.and(
	z.object({
		type: z.literal(TILES_WEATHER_PLUGIN_DAY_TYPE),
	})
);

export const ForecastWeatherTileResSchema: ZodType<ApiForecastWeatherTile> = TileResSchema.and(
	z.object({
		type: z.literal(TILES_WEATHER_PLUGIN_FORECAST_TYPE),
	})
);
