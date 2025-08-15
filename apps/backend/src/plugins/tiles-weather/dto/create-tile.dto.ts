import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';

type CreateDayWeatherTile = components['schemas']['TilesWeatherPluginCreateDayWeatherTile'];
type CreateForecastWeatherTile = components['schemas']['TilesWeatherPluginCreateForecastWeatherTile'];

export class CreateDayWeatherTileDto extends CreateSingleTileDto implements CreateDayWeatherTile {
	readonly type: 'weather-day';
}

export class CreateForecastWeatherTileDto extends CreateSingleTileDto implements CreateForecastWeatherTile {
	readonly type: 'weather-forecast';
}
