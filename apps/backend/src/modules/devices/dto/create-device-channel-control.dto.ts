import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqCreateChannelControl = components['schemas']['DevicesModuleReqCreateChannelControl'];
type CreateChannelControl = components['schemas']['DevicesModuleCreateChannelControl'];

export class CreateDeviceChannelControlDto implements CreateChannelControl {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;
}

export class ReqCreateDeviceChannelControlDto implements ReqCreateChannelControl {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceChannelControlDto)
	data: CreateDeviceChannelControlDto;
}
