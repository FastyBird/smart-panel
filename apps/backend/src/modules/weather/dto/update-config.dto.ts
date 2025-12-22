import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@ApiSchema({ name: 'ConfigModuleUpdateWeather' })
export class UpdateWeatherConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'weather-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = WEATHER_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'primary_location_id',
		description: 'Primary weather location ID',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose({ name: 'primary_location_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"primary_location_id","reason":"Primary location ID must be a valid UUID."}]' })
	@ValidateIf((_, value) => value !== null)
	primary_location_id?: string | null;
}
