import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

type ReqCreateChannelProperty = components['schemas']['DevicesModuleReqCreateChannelProperty'];
type CreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];

@ApiSchema({ name: 'DevicesModuleCreateChannelProperty' })
export class CreateChannelPropertyDto extends CreateDeviceChannelPropertyDto implements CreateChannelProperty {}

@ApiSchema({ name: 'DevicesModuleReqCreateChannelProperty' })
export class ReqCreateChannelPropertyDto implements ReqCreateChannelProperty {
	@ApiProperty({ description: 'Channel property data', type: CreateChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelPropertyDto)
	data: CreateChannelPropertyDto;
}
