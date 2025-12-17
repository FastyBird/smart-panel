import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@ApiSchema({ name: 'ConfigModuleDataWeather' })
export class WeatherConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'weather-module',
	})
	@Expose()
	@IsString()
	type: string = WEATHER_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'primary_location_id',
		description: 'Primary weather location ID',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'primary_location_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"primary_location_id","reason":"Primary location ID must be a valid UUID."}]' })
	primaryLocationId: string | null = null;
}
