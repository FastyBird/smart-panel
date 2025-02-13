import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelDataSourceDto } from './create-data-source.dto';

type ReqCreatePageDataSource = components['schemas']['DashboardReqCreatePageDataSource'];

export class CreatePageDeviceChannelDataSourceDto extends CreateDeviceChannelDataSourceDto {}

export class ReqCreatePageDataSourceDto implements ReqCreatePageDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => CreatePageDeviceChannelDataSourceDto)
	data: CreatePageDeviceChannelDataSourceDto;
}
