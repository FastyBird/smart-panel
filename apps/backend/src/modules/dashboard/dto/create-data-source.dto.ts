import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

import { ParentDto } from './common.dto';

type ReqCreateDataSource = components['schemas']['DashboardModuleReqCreateDataSource'];
type ReqCreateDataSourceWithParent = components['schemas']['DashboardModuleReqCreateDataSourceWithParent'];
type CreateDataSource = components['schemas']['DashboardModuleCreateDataSource'];

@ApiSchema('DashboardModuleCreateDataSource')
export abstract class CreateDataSourceDto implements CreateDataSource {
	@ApiPropertyOptional({
		description: 'Data source ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({ description: 'Data source type', type: 'string', example: 'device' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;
}

@ApiSchema('DashboardModuleCreateSingleDataSource')
export class CreateSingleDataSourceDto extends CreateDataSourceDto {
	@ApiProperty({ description: 'Parent entity information', type: () => ParentDto })
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

@ApiSchema('DashboardModuleReqCreateDataSource')
export class ReqCreateDataSourceDto implements ReqCreateDataSource {
	@ApiProperty({ description: 'Data source data', type: () => CreateSingleDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleDataSourceDto)
	data: CreateSingleDataSourceDto;
}

@ApiSchema('DashboardModuleReqCreateDataSourceWithParent')
export class ReqCreateDataSourceWithParentDto implements ReqCreateDataSourceWithParent {
	@ApiProperty({ description: 'Data source data', type: () => CreateDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateDataSourceDto)
	data: CreateDataSourceDto;
}
