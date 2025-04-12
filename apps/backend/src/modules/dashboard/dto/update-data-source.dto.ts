import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDataSource = components['schemas']['DashboardReqUpdateDataSource'];
type UpdateDataSource = components['schemas']['DashboardUpdateDataSource'];

export abstract class UpdateDataSourceDto implements UpdateDataSource {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;
}

export class ReqUpdateDataSourceDto implements ReqUpdateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDataSourceDto)
	data: UpdateDataSourceDto;
}
