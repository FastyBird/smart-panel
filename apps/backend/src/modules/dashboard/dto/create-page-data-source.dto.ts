import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelDataSourceDto } from './create-data-source.dto';

type ReqCreateDataSource = components['schemas']['DashboardReqCreateDataSource'];

export class CreatePageDeviceChannelDataSourceDto extends CreateDeviceChannelDataSourceDto {}

export class ReqCreatePageDataSourceDto implements ReqCreateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => CreatePageDeviceChannelDataSourceDto)
	data: CreatePageDeviceChannelDataSourceDto;
}
