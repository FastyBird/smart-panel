import { Expose, Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

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

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID to display. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'location_id' })
	@IsOptional()
	@IsUUID('4')
	readonly location_id?: string;
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

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID to display. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'location_id' })
	@IsOptional()
	@IsUUID('4')
	readonly location_id?: string;
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
