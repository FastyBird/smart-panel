import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';

type ReqCreateChannelControl = components['schemas']['DevicesModuleReqCreateChannelControl'];
type CreateChannelControl = components['schemas']['DevicesModuleCreateChannelControl'];

@ApiSchema({ name: 'DevicesModuleCreateChannelControl' })
export class CreateChannelControlDto extends CreateDeviceChannelControlDto implements CreateChannelControl {}

@ApiSchema({ name: 'DevicesModuleReqCreateChannelControl' })
export class ReqCreateChannelControlDto implements ReqCreateChannelControl {
	@ApiProperty({ description: 'Channel control data', type: CreateChannelControlDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelControlDto)
	data: CreateChannelControlDto;
}
