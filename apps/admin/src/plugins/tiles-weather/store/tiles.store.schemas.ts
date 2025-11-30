import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { type components } from '../../../openapi';
import { TILES_WEATHER_PLUGIN_DAY_TYPE, TILES_WEATHER_PLUGIN_FORECAST_TYPE } from '../tiles-weather.constants';

type ApiCreateDayWeatherTile = components['schemas']['TilesWeatherPluginCreateDayWeatherTile'];
type ApiCreateForecastWeatherTile = components['schemas']['TilesWeatherPluginCreateForecastWeatherTile'];
type ApiUpdateDayWeatherTile = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
type ApiUpdateForecastWeatherTile = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];
type ApiDayWeatherTile = components['schemas']['TilesWeatherPluginDataDayWeatherTile'];
type ApiForecastWeatherTile = components['schemas']['TilesWeatherPluginDataForecastWeatherTile'];

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

export const DayWeatherTileUpdateReqSchema: ZodType<ApiUpdateDayWeatherTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.literal(TILES_WEATHER_PLUGIN_DAY_TYPE),
	})
);

export const ForecastWeatherTileUpdateReqSchema: ZodType<ApiUpdateForecastWeatherTile> = TileUpdateReqSchema.and(
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
