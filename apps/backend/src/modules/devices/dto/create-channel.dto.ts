import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

import { CreateDeviceChannelDto } from './create-device-channel.dto';

type ReqCreateChannel = components['schemas']['DevicesModuleReqCreateChannel'];
type CreateChannel = components['schemas']['DevicesModuleCreateChannel'];

@ApiSchema({ name: 'DevicesModuleCreateChannel' })
export class CreateChannelDto extends CreateDeviceChannelDto implements CreateChannel {
	@ApiProperty({
		description: 'Device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}

@ApiSchema({ name: 'DevicesModuleReqCreateChannel' })
export class ReqCreateChannelDto implements ReqCreateChannel {
	@ApiProperty({ description: 'Channel data', type: CreateChannelDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateChannelDto)
	data: CreateChannelDto;
}
