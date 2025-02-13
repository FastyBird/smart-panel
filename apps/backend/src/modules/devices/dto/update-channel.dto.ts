import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { UpdateDeviceChannelDto } from './update-device-channel.dto';

type ReqUpdateChannel = components['schemas']['DevicesReqUpdateChannel'];
type UpdateChannel = components['schemas']['DevicesUpdateChannel'];

export class UpdateChannelDto extends UpdateDeviceChannelDto implements UpdateChannel {}

export class ReqUpdateChannelDto implements ReqUpdateChannel {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelDto)
	data: UpdateChannelDto;
}
