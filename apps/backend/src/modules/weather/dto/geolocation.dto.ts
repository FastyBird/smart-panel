import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

@ApiSchema('WeatherModuleGeolocationCity')
export class GeolocationCityDto {
	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	@IsString()
	@IsDefined()
	name: string;

	@ApiPropertyOptional({
		name: 'local_names',
		description: 'City name in different languages',
		example: { en: 'London', ru: 'Лондон' },
	})
	@Expose()
	@IsOptional()
	@IsObject()
	@Type(() => Object)
	local_names?: Record<string, string>;

	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	@IsNumber()
	lat: number;

	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	@IsNumber()
	lon: number;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	@IsString()
	country: string;

	@ApiPropertyOptional({ description: 'State (if applicable)', type: 'string', example: 'England' })
	@Expose()
	@IsOptional()
	@IsString()
	state?: string;
}

@ApiSchema('WeatherModuleGeolocationZip')
export class GeolocationZipDto {
	@ApiProperty({ description: 'Zip/postal code', type: 'string', example: 'SW1A 1AA' })
	@Expose()
	@IsString()
	@IsDefined()
	zip: string;

	@ApiProperty({ description: 'City name', type: 'string', example: 'London' })
	@Expose()
	@IsString()
	@IsDefined()
	name: string;

	@ApiProperty({ description: 'Latitude', type: 'number', example: 51.5074 })
	@Expose()
	@IsNumber()
	lat: number;

	@ApiProperty({ description: 'Longitude', type: 'number', example: -0.1278 })
	@Expose()
	@IsNumber()
	lon: number;

	@ApiProperty({ description: 'Country code', type: 'string', example: 'GB' })
	@Expose()
	@IsString()
	country: string;
}
