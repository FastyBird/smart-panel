import { Expose, Type } from 'class-transformer';
import { IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

import { CreateDeviceChannelDto } from './create-device-channel.dto';

type ReqCreateChannel = components['schemas']['DevicesModuleReqCreateChannel'];
type CreateChannel = components['schemas']['DevicesModuleCreateChannel'];

export class CreateChannelDto extends CreateDeviceChannelDto implements CreateChannel {
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}

export class ReqCreateChannelDto implements ReqCreateChannel {
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelDto)
	data: CreateChannelDto;
}
