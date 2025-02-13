import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ChannelCategory } from '../devices.constants';
import { UniqueControlNames } from '../validators/unique-control-names-constraint.validator';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';
import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

type ReqCreateDeviceChannel = components['schemas']['DevicesReqCreateDeviceChannel'];
type CreateDeviceChannel = components['schemas']['DevicesCreateDeviceChannel'];

export class CreateDeviceChannelDto implements CreateDeviceChannel {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	@IsEnum(ChannelCategory, {
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	category: ChannelCategory;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"controls","reason":"Controls must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceChannelControlDto)
	@UniqueControlNames({
		message: '[{"field":"controls.name","reason":"Each control name must be unique."}]',
	})
	controls?: CreateDeviceChannelControlDto[];

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"properties","reason":"Properties must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceChannelPropertyDto)
	properties?: CreateDeviceChannelPropertyDto[];
}

export class ReqCreateDeviceChannelDto implements ReqCreateDeviceChannel {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceChannelDto)
	data: CreateDeviceChannelDto;
}
