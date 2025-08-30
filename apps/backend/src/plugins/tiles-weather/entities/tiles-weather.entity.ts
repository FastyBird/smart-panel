import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ChildEntity()
export class DayWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return TILES_WEATHER_DAY_TYPE;
	}
}

@ChildEntity()
export class ForecastWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return TILES_WEATHER_FORECAST_TYPE;
	}
}
