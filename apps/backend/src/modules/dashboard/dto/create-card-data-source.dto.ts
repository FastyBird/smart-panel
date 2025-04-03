import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelDataSourceDto } from './create-data-source.dto';

type ReqCreateDataSource = components['schemas']['DashboardReqCreateDataSource'];

export class CreateCardDeviceChannelDataSourceDto extends CreateDeviceChannelDataSourceDto {}

export class ReqCreateCardDataSourceDto implements ReqCreateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => CreateCardDeviceChannelDataSourceDto)
	data: CreateCardDeviceChannelDataSourceDto;
}
