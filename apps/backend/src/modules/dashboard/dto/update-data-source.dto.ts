import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { ParentDto } from './common.dto';

type ReqUpdateDataSource = components['schemas']['DashboardModuleReqUpdateDataSource'];
type UpdateDataSource = components['schemas']['DashboardModuleUpdateDataSource'];

export abstract class UpdateDataSourceDto implements UpdateDataSource {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;
}

export class UpdateSingleDataSourceDto extends UpdateDataSourceDto {
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

export class ReqUpdateDataSourceDto implements ReqUpdateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDataSourceDto)
	data: UpdateDataSourceDto;
}

export class ReqUpdateDataSourceWithParentDto implements ReqUpdateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSingleDataSourceDto)
	data: UpdateSingleDataSourceDto;
}
