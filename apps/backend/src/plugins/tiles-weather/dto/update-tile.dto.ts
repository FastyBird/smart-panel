import { ApiSchema } from '@nestjs/swagger';

import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import type { components } from '../../../openapi';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

type UpdateDayWeatherTile = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
type UpdateForecastWeatherTile = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];

@ApiSchema({ name: 'TilesWeatherPluginUpdateDayWeatherTile' })
export class UpdateDayWeatherTileDto extends UpdateTileDto implements UpdateDayWeatherTile {
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginUpdateForecastWeatherTile' })
export class UpdateForecastWeatherTileDto extends UpdateTileDto implements UpdateForecastWeatherTile {
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}
