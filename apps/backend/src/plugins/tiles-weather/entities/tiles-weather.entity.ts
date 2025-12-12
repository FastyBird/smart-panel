import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginDataDayWeatherTile' })
@ChildEntity()
export class DayWeatherTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_DAY_TYPE,
		example: TILES_WEATHER_DAY_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_WEATHER_DAY_TYPE;
	}

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID to display. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'location_id' })
	@Transform(({ obj }: { obj: { location_id?: string; locationId?: string } }) => obj.location_id || obj.locationId, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsUUID('4')
	@Column({ type: 'uuid', name: 'location_id', nullable: true })
	locationId?: string | null;
}

@ApiSchema({ name: 'TilesWeatherPluginDataForecastWeatherTile' })
@ChildEntity()
export class ForecastWeatherTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_WEATHER_FORECAST_TYPE,
		example: TILES_WEATHER_FORECAST_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_WEATHER_FORECAST_TYPE;
	}

	@ApiPropertyOptional({
		name: 'location_id',
		description: 'Weather location ID to display. If not set, uses primary location.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'location_id' })
	@Transform(({ obj }: { obj: { location_id?: string; locationId?: string } }) => obj.location_id || obj.locationId, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsUUID('4')
	@Column({ type: 'uuid', name: 'location_id', nullable: true })
	locationId?: string | null;
}
