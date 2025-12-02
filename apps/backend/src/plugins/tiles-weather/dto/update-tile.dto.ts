import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

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
