import { Expose, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDataSourceType } from '../validators/data-source-type-constraint.validator';

import { ParentDto } from './common.dto';
import { CreateDataSourceDto } from './create-data-source.dto';

type ReqCreateTile = components['schemas']['DashboardReqCreateTile'];
type ReqCreateTileWithParent = components['schemas']['DashboardReqCreateTileWithParent'];
type CreateTile = components['schemas']['DashboardCreateTile'];

export abstract class CreateTileDto implements CreateTile {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	readonly type: string;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateDataSourceType()
	@Type(() => CreateDataSourceDto)
	data_source?: CreateDataSourceDto[];

	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	row: number;

	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	col: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col_span","reason":"Row span minimum value must be greater than 0."}]' })
	row_span?: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col_span","reason":"Column span minimum value must be greater than 0."}]' })
	col_span?: number;
}

export class CreateSingleTileDto extends CreateTileDto {
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

export class ReqCreateTileDto implements ReqCreateTile {
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleTileDto)
	data: CreateSingleTileDto;
}

export class ReqCreateTileWithParentDto implements ReqCreateTileWithParent {
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleTileDto)
	data: CreateSingleTileDto;
}
