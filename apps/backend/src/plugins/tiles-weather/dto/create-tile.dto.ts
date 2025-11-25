import { ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginCreateDayWeatherTile' })
export class CreateDayWeatherTileDto extends CreateSingleTileDto {
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginCreateForecastWeatherTile' })
export class CreateForecastWeatherTileDto extends CreateSingleTileDto {
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}
