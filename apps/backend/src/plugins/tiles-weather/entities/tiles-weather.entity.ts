import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginDataDayWeatherTile' })
@ChildEntity()
export class DayWeatherTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		example: TILES_WEATHER_DAY_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_WEATHER_DAY_TYPE;
	}
}

@ApiSchema({ name: 'TilesWeatherPluginDataForecastWeatherTile' })
@ChildEntity()
export class ForecastWeatherTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		example: TILES_WEATHER_FORECAST_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_WEATHER_FORECAST_TYPE;
	}
}
