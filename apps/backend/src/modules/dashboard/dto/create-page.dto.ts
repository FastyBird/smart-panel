import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { ValidateDisplayExists } from '../../displays/validators/display-exists-constraint.validator';
import { ValidateDataSourceType } from '../validators/data-source-type-constraint.validator';

import { CreateDataSourceDto } from './create-data-source.dto';

@ApiSchema({ name: 'DashboardModuleCreatePage' })
export class CreatePageDto {
	@ApiPropertyOptional({
		description: 'Page ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({ description: 'Page type', type: 'string', example: 'default' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	readonly type: string;

	@ApiProperty({ description: 'Page title', type: 'string', example: 'Dashboard' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title: string;

	@ApiPropertyOptional({ description: 'Page icon name', type: 'string', example: 'mdi:home', nullable: true })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiProperty({ description: 'Display order', type: 'integer', example: 1 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order: number;

	@ApiPropertyOptional({
		description: 'Whether to show top bar',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_top_bar","reason":"Show top bar attribute must be a valid true or false."}]' })
	show_top_bar?: boolean;

	@ApiPropertyOptional({
		description: 'Associated data sources',
		type: 'array',
		items: { $ref: getSchemaPath(CreateDataSourceDto) },
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateDataSourceType()
	@Type(() => CreateDataSourceDto)
	data_source?: CreateDataSourceDto[];

	@ApiPropertyOptional({
		description: 'Display IDs. Empty array or null means visible to all displays.',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['123e4567-e89b-12d3-a456-426614174000'],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@IsArray({ message: '[{"field":"displays","reason":"Displays must be an array."}]' })
	@IsUUID('4', {
		each: true,
		message: '[{"field":"displays","reason":"Each display must be a valid UUID (version 4)."}]',
	})
	@ValidateIf((_, value) => value !== null && Array.isArray(value) && value.length > 0)
	@ValidateDisplayExists({ message: '[{"field":"displays","reason":"One or more specified displays do not exist."}]' })
	displays?: string[] | null;
}

@ApiSchema({ name: 'DashboardModuleReqCreatePage' })
export class ReqCreatePageDto {
	@ApiProperty({ description: 'Page data', type: () => CreatePageDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreatePageDto)
	data: CreatePageDto;
}
