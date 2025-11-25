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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { ValidateDisplayProfileExists } from '../../system/validators/display-profile-exists-constraint.validator';
import { ValidateDataSourceType } from '../validators/data-source-type-constraint.validator';

import { CreateDataSourceDto } from './create-data-source.dto';

type ReqCreatePage = components['schemas']['DashboardModuleReqCreatePage'];
type CreatePage = components['schemas']['DashboardModuleCreatePage'];

@ApiSchema('DashboardModuleCreatePage')
export class CreatePageDto implements CreatePage {
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

	@ApiProperty({ description: 'Display order', type: 'number', example: 1 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order: number;

	@ApiPropertyOptional({
		name: 'show_top_bar',
		description: 'Whether to show top bar',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_top_bar","reason":"Show top bar attribute must be a valid true or false."}]' })
	show_top_bar?: boolean;

	@ApiPropertyOptional({
		name: 'data_source',
		description: 'Associated data sources',
		type: [CreateDataSourceDto],
		isArray: true,
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateDataSourceType()
	@Type(() => CreateDataSourceDto)
	data_source?: CreateDataSourceDto[];

	@ApiPropertyOptional({
		description: 'Display profile ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"display","reason":"Display must be a valid UUID (version 4)."}]' })
	@ValidateDisplayProfileExists({ message: '[{"field":"display","reason":"The specified display does not exist."}]' })
	display?: string;
}

@ApiSchema('DashboardModuleReqCreatePage')
export class ReqCreatePageDto implements ReqCreatePage {
	@ApiProperty({ description: 'Page data', type: () => CreatePageDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreatePageDto)
	data: CreatePageDto;
}
