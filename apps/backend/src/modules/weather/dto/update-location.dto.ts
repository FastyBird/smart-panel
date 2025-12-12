import { Expose, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleUpdateLocation' })
export class UpdateLocationDto {
	@ApiPropertyOptional({
		description: 'Location name',
		type: 'string',
		example: 'Home',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name?: string;

	@ApiPropertyOptional({
		description: 'Display order (lower numbers appear first)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order?: number;
}

@ApiSchema({ name: 'WeatherModuleReqUpdateLocation' })
export class ReqUpdateLocationDto {
	@ApiPropertyOptional({ description: 'Location data', type: () => UpdateLocationDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateLocationDto)
	data: UpdateLocationDto;
}
