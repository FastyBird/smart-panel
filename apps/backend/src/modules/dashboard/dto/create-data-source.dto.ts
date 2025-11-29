import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ParentDto } from './common.dto';

@ApiSchema({ name: 'DashboardModuleCreateDataSource' })
export abstract class CreateDataSourceDto {
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

@ApiSchema({ name: 'DashboardModuleCreateSingleDataSource' })
export class CreateSingleDataSourceDto extends CreateDataSourceDto {
	@ApiProperty({ description: 'Parent entity information', type: () => ParentDto })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"parent","reason":"Parent entity information is required."}]' })
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

@ApiSchema({ name: 'DashboardModuleReqCreateDataSource' })
export class ReqCreateDataSourceDto {
	@ApiProperty({ description: 'Data source data', type: () => CreateSingleDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleDataSourceDto)
	data: CreateSingleDataSourceDto;
}

@ApiSchema({ name: 'DashboardModuleReqCreateDataSourceWithParent' })
export class ReqCreateDataSourceWithParentDto {
	@ApiProperty({ description: 'Data source data', type: () => CreateSingleDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleDataSourceDto)
	data: CreateSingleDataSourceDto;
}
