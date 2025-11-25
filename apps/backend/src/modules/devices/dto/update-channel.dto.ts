import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

import { UpdateDeviceChannelDto } from './update-device-channel.dto';

type ReqUpdateChannel = components['schemas']['DevicesModuleReqUpdateChannel'];
type UpdateChannel = components['schemas']['DevicesModuleUpdateChannel'];

@ApiSchema('DevicesModuleUpdateChannel')
export class UpdateChannelDto extends UpdateDeviceChannelDto implements UpdateChannel {}

@ApiSchema('DevicesModuleReqUpdateChannel')
export class ReqUpdateChannelDto implements ReqUpdateChannel {
	@ApiProperty({ description: 'Channel data', type: UpdateChannelDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelDto)
	data: UpdateChannelDto;
}
