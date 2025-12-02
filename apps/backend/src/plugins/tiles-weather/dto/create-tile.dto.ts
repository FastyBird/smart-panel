import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginCreateDayWeatherTile' })
export class CreateDayWeatherTileDto extends CreateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_DAY_TYPE,
		example: TILES_WEATHER_DAY_TYPE,
	})
	readonly type: typeof TILES_WEATHER_DAY_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginCreateForecastWeatherTile' })
export class CreateForecastWeatherTileDto extends CreateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_FORECAST_TYPE,
		example: TILES_WEATHER_FORECAST_TYPE,
	})
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;
}

@ApiSchema({ name: 'TilesWeatherPluginReqCreateDayWeatherTile' })
export class ReqCreateDayWeatherTileDto {
	@ApiProperty({
		description: 'Day weather tile data',
		type: () => CreateDayWeatherTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateDayWeatherTileDto)
	data: CreateDayWeatherTileDto;
}

@ApiSchema({ name: 'TilesWeatherPluginReqCreateForecastWeatherTile' })
export class ReqCreateForecastWeatherTileDto {
	@ApiProperty({
		description: 'Forecast weather tile data',
		type: () => CreateForecastWeatherTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateForecastWeatherTileDto)
	data: CreateForecastWeatherTileDto;
}
