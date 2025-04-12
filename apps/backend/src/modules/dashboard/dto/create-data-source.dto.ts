import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { ParentDto } from './common.dto';

type ReqCreateDataSource = components['schemas']['DashboardReqCreateDataSource'];
type ReqCreateDataSourceWithParent = components['schemas']['DashboardReqCreateDataSourceWithParent'];
type CreateDataSource = components['schemas']['DashboardCreateDataSource'];

export abstract class CreateDataSourceDto implements CreateDataSource {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;
}

export class CreateSingleDataSourceDto extends CreateDataSourceDto {
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

export class ReqCreateDataSourceDto implements ReqCreateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleDataSourceDto)
	data: CreateSingleDataSourceDto;
}

export class ReqCreateDataSourceWithParentDto implements ReqCreateDataSourceWithParent {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDataSourceDto)
	data: CreateDataSourceDto;
}
