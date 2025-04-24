import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqCreateDeviceControl = components['schemas']['DevicesModuleReqCreateDeviceControl'];
type CreateDeviceControl = components['schemas']['DevicesModuleCreateDeviceControl'];

export class CreateDeviceControlDto implements CreateDeviceControl {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	readonly name: string;
}

export class ReqCreateDeviceControlDto implements ReqCreateDeviceControl {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceControlDto)
	data: CreateDeviceControlDto;
}
