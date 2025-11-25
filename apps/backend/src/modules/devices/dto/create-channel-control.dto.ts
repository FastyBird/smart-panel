import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';

@ApiSchema({ name: 'DevicesModuleCreateChannelControl' })
export class CreateChannelControlDto extends CreateDeviceChannelControlDto {}

@ApiSchema({ name: 'DevicesModuleReqCreateChannelControl' })
export class ReqCreateChannelControlDto {
	@ApiProperty({ description: 'Channel control data', type: CreateChannelControlDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelControlDto)
	data: CreateChannelControlDto;
}
