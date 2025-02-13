import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelDataSourceDto } from './create-data-source.dto';

type ReqCreateTileDataSource = components['schemas']['DashboardReqCreateTileDataSource'];

export class CreateTileDeviceChannelDataSourceDto extends CreateDeviceChannelDataSourceDto {}

export class ReqCreateTileDataSourceDto implements ReqCreateTileDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => CreateTileDeviceChannelDataSourceDto)
	data: CreateTileDeviceChannelDataSourceDto;
}
