import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';

type ReqCreateChannelControl = components['schemas']['DevicesModuleReqCreateChannelControl'];
type CreateChannelControl = components['schemas']['DevicesModuleCreateChannelControl'];

@ApiSchema('DevicesModuleCreateChannelControl')
export class CreateChannelControlDto extends CreateDeviceChannelControlDto implements CreateChannelControl {}

@ApiSchema('DevicesModuleReqCreateChannelControl')
export class ReqCreateChannelControlDto implements ReqCreateChannelControl {
	@ApiProperty({ description: 'Channel control data', type: CreateChannelControlDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelControlDto)
	data: CreateChannelControlDto;
}
