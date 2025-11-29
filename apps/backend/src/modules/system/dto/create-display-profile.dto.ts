import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleCreateDisplayProfile' })
export class CreateDisplayProfileDto {
	@ApiPropertyOptional({
		description: 'Optional display profile ID (UUID v4)',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Display profile unique identifier (UUID v4)',
		format: 'uuid',
		example: 'a1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsNotEmpty()
	@IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
	uid: string;

	@ApiProperty({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose()
	@IsInt({ message: '[{"field":"screen_width","reason":"Display screen width must be a valid number."}]' })
	screen_width: number;

	@ApiProperty({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose()
	@IsInt({ message: '[{"field":"screen_height","reason":"Display screen height must be a valid number."}]' })
	screen_height: number;

	@ApiProperty({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"pixel_ratio","reason":"Display pixel ratio is required."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"pixel_ratio","reason":"Display pixel ratio must be a valid number."}]' },
	)
	pixel_ratio: number;

	@ApiProperty({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'integer',
		example: 8,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"unit_size","reason":"Display unit size is required."}]' })
	@IsInt({ message: '[{"field":"unit_size","reason":"Display unit size must be a valid integer."}]' })
	unit_size: number;

	@ApiProperty({
		description: 'Default row count',
		type: 'integer',
		minimum: 1,
		example: 12,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"rows","reason":"Default row count is required."}]' })
	@IsInt({ message: '[{"field":"rows","reason":"Default row count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Default row count must be at least 1."}]' })
	rows: number;

	@ApiProperty({
		description: 'Default column count',
		type: 'integer',
		minimum: 1,
		example: 24,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"cols","reason":"Default column count is required."}]' })
	@IsInt({ message: '[{"field":"cols","reason":"Default column count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Default column count must be at least 1."}]' })
	cols: number;

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

@ApiSchema({ name: 'SystemModuleReqCreateDisplayProfile' })
export class ReqCreateDisplayProfileDto {
	@ApiProperty({
		description: 'Display profile creation data',
		type: CreateDisplayProfileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateDisplayProfileDto)
	data: CreateDisplayProfileDto;
}
