import { Expose, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleCreateLocation' })
export class CreateLocationDto {
	@ApiPropertyOptional({
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Location type (weather provider)',
		type: 'string',
		example: 'weather-openweathermap',
	})
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported weather provider."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported weather provider."}]',
	})
	type: string;

	@ApiProperty({
		description: 'Location name',
		type: 'string',
		example: 'Home',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Display order (lower numbers appear first)',
		type: 'integer',
		example: 0,
		default: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order?: number;
}

@ApiSchema({ name: 'WeatherModuleReqCreateLocation' })
export class ReqCreateLocationDto {
	@ApiProperty({ description: 'Location data', type: () => CreateLocationDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateLocationDto)
	data: CreateLocationDto;
}
