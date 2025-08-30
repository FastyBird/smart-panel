import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import type { components } from '../../../openapi';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

type UpdateDayWeatherTile = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
type UpdateForecastWeatherTile = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];

export class UpdateDayWeatherTileDto extends UpdateTileDto implements UpdateDayWeatherTile {
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

export class UpdateForecastWeatherTileDto extends UpdateTileDto implements UpdateForecastWeatherTile {
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}
