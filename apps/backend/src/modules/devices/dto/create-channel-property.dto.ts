import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesModuleCreateChannelProperty' })
export class CreateChannelPropertyDto extends CreateDeviceChannelPropertyDto {}

@ApiSchema({ name: 'DevicesModuleReqCreateChannelProperty' })
export class ReqCreateChannelPropertyDto {
	@ApiProperty({ description: 'Channel property data', type: CreateChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelPropertyDto)
	data: CreateChannelPropertyDto;
}
