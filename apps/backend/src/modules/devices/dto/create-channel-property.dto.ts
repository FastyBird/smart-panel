import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

type ReqCreateChannelProperty = components['schemas']['DevicesModuleReqCreateChannelProperty'];
type CreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];

@ApiSchema('DevicesModuleCreateChannelProperty')
export class CreateChannelPropertyDto extends CreateDeviceChannelPropertyDto implements CreateChannelProperty {}

@ApiSchema('DevicesModuleReqCreateChannelProperty')
export class ReqCreateChannelPropertyDto implements ReqCreateChannelProperty {
	@ApiProperty({ description: 'Channel property data', type: CreateChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelPropertyDto)
	data: CreateChannelPropertyDto;
}
