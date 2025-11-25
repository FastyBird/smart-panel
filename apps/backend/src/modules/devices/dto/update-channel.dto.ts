import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

import { UpdateDeviceChannelDto } from './update-device-channel.dto';

type ReqUpdateChannel = components['schemas']['DevicesModuleReqUpdateChannel'];
type UpdateChannel = components['schemas']['DevicesModuleUpdateChannel'];

@ApiSchema({ name: 'DevicesModuleUpdateChannel' })
export class UpdateChannelDto extends UpdateDeviceChannelDto implements UpdateChannel {}

@ApiSchema({ name: 'DevicesModuleReqUpdateChannel' })
export class ReqUpdateChannelDto implements ReqUpdateChannel {
	@ApiProperty({ description: 'Channel data', type: UpdateChannelDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelDto)
	data: UpdateChannelDto;
}
