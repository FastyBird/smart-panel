import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqCreateDisplayProfile = components['schemas']['SystemModuleReqCreateDisplayProfile'];
type CreateDisplayProfile = components['schemas']['SystemModuleCreateDisplayProfile'];

export class CreateDisplayProfileDto implements CreateDisplayProfile {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty()
	@IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
	uid: string;

	@Expose()
	@IsInt({ message: '[{"field":"screen_width","reason":"Display screen width must be a valid number."}]' })
	screen_width: number;

	@Expose()
	@IsInt({ message: '[{"field":"screen_height","reason":"Display screen height must be a valid number."}]' })
	screen_height: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"pixel_ratio","reason":"Display pixel ratio must be a valid number."}]' },
	)
	pixel_ratio: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"unit_size","reason":"Display unit size must be a valid number."}]' },
	)
	unit_size: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Default row count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Default row count must be at least 1."}]' })
	rows: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Default column count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Default column count must be at least 1."}]' })
	cols: number;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Primary attribute must be a valid true or false."}]' })
	primary?: boolean;
}

export class ReqCreateDisplayProfileDto implements ReqCreateDisplayProfile {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDisplayProfileDto)
	data: CreateDisplayProfileDto;
}
