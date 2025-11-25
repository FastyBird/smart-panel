import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { ValidateDataSourceType } from '../validators/data-source-type-constraint.validator';

import { ParentDto } from './common.dto';
import { CreateDataSourceDto } from './create-data-source.dto';

type ReqCreateTile = components['schemas']['DashboardModuleReqCreateTile'];
type ReqCreateTileWithParent = components['schemas']['DashboardModuleReqCreateTileWithParent'];
type CreateTile = components['schemas']['DashboardModuleCreateTile'];

@ApiSchema('DashboardModuleCreateTile')
export abstract class CreateTileDto implements CreateTile {
	@ApiPropertyOptional({
		description: 'Tile ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({ description: 'Tile type', type: 'string', example: 'default' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	readonly type: string;

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

	@ApiProperty({ description: 'Grid row position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Row minimum value must be greater than 0."}]' })
	row: number;

	@ApiProperty({ description: 'Grid column position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Column minimum value must be greater than 0."}]' })
	col: number;

	@ApiPropertyOptional({
		name: 'row_span',
		description: 'Number of rows the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"row_span","reason":"Row span minimum value must be greater than 0."}]' })
	row_span?: number;

	@ApiPropertyOptional({
		name: 'col_span',
		description: 'Number of columns the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col_span","reason":"Column span minimum value must be greater than 0."}]' })
	col_span?: number;

	@ApiPropertyOptional({ description: 'Whether tile is hidden', type: 'boolean', example: false })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Hidden attribute must be a valid true or false."}]' })
	hidden?: boolean;
}

@ApiSchema('DashboardModuleCreateSingleTile')
export class CreateSingleTileDto extends CreateTileDto {
	@ApiProperty({ description: 'Parent entity information', type: () => ParentDto })
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

@ApiSchema('DashboardModuleReqCreateTile')
export class ReqCreateTileDto implements ReqCreateTile {
	@ApiProperty({ description: 'Tile data', type: () => CreateSingleTileDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleTileDto)
	data: CreateSingleTileDto;
}

@ApiSchema('DashboardModuleReqCreateTileWithParent')
export class ReqCreateTileWithParentDto implements ReqCreateTileWithParent {
	@ApiProperty({ description: 'Tile data', type: () => CreateSingleTileDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleTileDto)
	data: CreateSingleTileDto;
}
