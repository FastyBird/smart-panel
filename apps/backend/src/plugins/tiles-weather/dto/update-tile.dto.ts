import { ApiSchema } from '@nestjs/swagger';

import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginUpdateDayWeatherTile' })
export class UpdateDayWeatherTileDto extends UpdateTileDto {
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginUpdateForecastWeatherTile' })
export class UpdateForecastWeatherTileDto extends UpdateTileDto {
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}
