import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';

type ReqCreateChannelControl = components['schemas']['DevicesReqCreateChannelControl'];
type CreateChannelControl = components['schemas']['DevicesCreateChannelControl'];

export class CreateChannelControlDto extends CreateDeviceChannelControlDto implements CreateChannelControl {}

export class ReqCreateChannelControlDto implements ReqCreateChannelControl {
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelControlDto)
	data: CreateChannelControlDto;
}
