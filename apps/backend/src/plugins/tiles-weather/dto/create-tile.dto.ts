import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';

type CreateDayWeatherTile = components['schemas']['DashboardCreateDayWeatherTile'];
type CreateForecastWeatherTile = components['schemas']['DashboardCreateForecastWeatherTile'];

export class CreateDayWeatherTileDto extends CreateTileDto implements CreateDayWeatherTile {
	readonly type: 'weather-day';
}

export class CreateForecastWeatherTileDto extends CreateTileDto implements CreateForecastWeatherTile {
	readonly type: 'weather-forecast';
}
