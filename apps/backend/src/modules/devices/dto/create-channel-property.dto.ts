import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

type ReqCreateChannelProperty = components['schemas']['DevicesModuleReqCreateChannelProperty'];
type CreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];

export class CreateChannelPropertyDto extends CreateDeviceChannelPropertyDto implements CreateChannelProperty {}

export class ReqCreateChannelPropertyDto implements ReqCreateChannelProperty {
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelPropertyDto)
	data: CreateChannelPropertyDto;
}
