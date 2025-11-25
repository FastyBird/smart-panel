import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

import { ParentDto } from './common.dto';

type ReqUpdateDataSource = components['schemas']['DashboardModuleReqUpdateDataSource'];
type UpdateDataSource = components['schemas']['DashboardModuleUpdateDataSource'];

@ApiSchema({ name: 'DashboardModuleUpdateDataSource' })
export abstract class UpdateDataSourceDto implements UpdateDataSource {
	@ApiProperty({ description: 'Data source type', type: 'string', example: 'device' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;
}

@ApiSchema({ name: 'DashboardModuleUpdateSingleDataSource' })
export class UpdateSingleDataSourceDto extends UpdateDataSourceDto {
	@ApiProperty({ description: 'Parent entity information', type: () => ParentDto })
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

@ApiSchema({ name: 'DashboardModuleReqUpdateDataSource' })
export class ReqUpdateDataSourceDto implements ReqUpdateDataSource {
	@ApiProperty({ description: 'Data source data', type: () => UpdateDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDataSourceDto)
	data: UpdateDataSourceDto;
}

@ApiSchema({ name: 'DashboardModuleReqUpdateDataSourceWithParent' })
export class ReqUpdateDataSourceWithParentDto implements ReqUpdateDataSource {
	@ApiProperty({ description: 'Data source data', type: () => UpdateSingleDataSourceDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSingleDataSourceDto)
	data: UpdateSingleDataSourceDto;
}
