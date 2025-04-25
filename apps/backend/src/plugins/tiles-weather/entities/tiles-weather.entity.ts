import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';

@ChildEntity()
export class DayWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'weather-day';
	}
}

@ChildEntity()
export class ForecastWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'weather-forecast';
	}
}
