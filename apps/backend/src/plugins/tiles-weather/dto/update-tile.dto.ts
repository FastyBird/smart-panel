import { Expose, Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateSingleTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginUpdateDayWeatherTile' })
export class UpdateDayWeatherTileDto extends UpdateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_DAY_TYPE,
		example: TILES_WEATHER_DAY_TYPE,
	})
	readonly type: typeof TILES_WEATHER_DAY_TYPE;

	@ApiPropertyOptional({
		name: 'location_id',
		description:
			'Weather location ID to display. If not set, uses primary location. Set to null to use primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	@Expose({ name: 'location_id' })
	@IsOptional()
	@IsUUID('4')
	readonly location_id?: string | null;
}

@ApiSchema({ name: 'TilesWeatherPluginUpdateForecastWeatherTile' })
export class UpdateForecastWeatherTileDto extends UpdateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_FORECAST_TYPE,
		example: TILES_WEATHER_FORECAST_TYPE,
	})
	readonly type: typeof TILES_WEATHER_FORECAST_TYPE;

	@ApiPropertyOptional({
		name: 'location_id',
		description:
			'Weather location ID to display. If not set, uses primary location. Set to null to use primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true,
	})
	@Expose({ name: 'location_id' })
	@IsOptional()
	@IsUUID('4')
	readonly location_id?: string | null;
}

@ApiSchema({ name: 'TilesWeatherPluginReqUpdateDayWeatherTile' })
export class ReqUpdateDayWeatherTileDto {
	@ApiProperty({
		description: 'Day weather tile data',
		type: () => UpdateDayWeatherTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDayWeatherTileDto)
	data: UpdateDayWeatherTileDto;
}

@ApiSchema({ name: 'TilesWeatherPluginReqUpdateForecastWeatherTile' })
export class ReqUpdateForecastWeatherTileDto {
	@ApiProperty({
		description: 'Forecast weather tile data',
		type: () => UpdateForecastWeatherTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateForecastWeatherTileDto)
	data: UpdateForecastWeatherTileDto;
}
