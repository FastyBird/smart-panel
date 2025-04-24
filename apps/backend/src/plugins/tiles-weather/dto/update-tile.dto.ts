import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import type { components } from '../../../openapi';

type UpdateDayWeatherTile = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
type UpdateForecastWeatherTile = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];

export class UpdateDayWeatherTileDto extends UpdateTileDto implements UpdateDayWeatherTile {
	readonly type: 'weather-day';
}

export class UpdateForecastWeatherTileDto extends UpdateTileDto implements UpdateForecastWeatherTile {
	readonly type: 'weather-forecast';
}
