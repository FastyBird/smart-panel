import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleUpdateDisplayProfile' })
export class UpdateDisplayProfileDto {
	@ApiPropertyOptional({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'integer',
		minimum: 1,
		example: 8,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"unit_size","reason":"Default unit size must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"unit_size","reason":"Default unit size must be at least 1."}]' })
	unit_size?: number;

	@ApiPropertyOptional({
		description: 'Default row count',
		type: 'integer',
		minimum: 1,
		example: 12,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Default row count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Default row count must be at least 1."}]' })
	rows?: number;

	@ApiPropertyOptional({
		description: 'Default column count',
		type: 'integer',
		minimum: 1,
		example: 24,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Default column count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Default column count must be at least 1."}]' })
	cols?: number;

	@ApiPropertyOptional({
		description: 'Whether this is the primary display profile',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Primary attribute must be a valid true or false."}]' })
	primary?: boolean;
}

@ApiSchema({ name: 'SystemModuleReqUpdateDisplayProfile' })
export class ReqUpdateDisplayProfileDto {
	@ApiProperty({
		description: 'Display profile update data',
		type: UpdateDisplayProfileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayProfileDto)
	data: UpdateDisplayProfileDto;
}
