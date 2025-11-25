import { ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

type CreateDayWeatherTile = components['schemas']['TilesWeatherPluginCreateDayWeatherTile'];
type CreateForecastWeatherTile = components['schemas']['TilesWeatherPluginCreateForecastWeatherTile'];

@ApiSchema({ name: 'TilesWeatherPluginCreateDayWeatherTile' })
export class CreateDayWeatherTileDto extends CreateSingleTileDto implements CreateDayWeatherTile {
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginCreateForecastWeatherTile' })
export class CreateForecastWeatherTileDto extends CreateSingleTileDto implements CreateForecastWeatherTile {
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}
