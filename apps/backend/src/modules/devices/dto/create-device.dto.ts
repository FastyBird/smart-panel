import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../devices.constants';
import { UniqueControlNames } from '../validators/unique-control-names-constraint.validator';

import { CreateDeviceChannelDto } from './create-device-channel.dto';
import { CreateDeviceControlDto } from './create-device-control.dto';

@ApiSchema({ name: 'DevicesModuleCreateDevice' })
export class CreateDeviceDto {
	@ApiPropertyOptional({
		description: 'Device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Device type', type: 'string', example: 'generic' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	type: string;

	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.GENERIC })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	category: DeviceCategory;

	@ApiPropertyOptional({ description: 'Device identifier', type: 'string', example: 'device-001' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string;

	@ApiProperty({ description: 'Device name', type: 'string', example: 'Living Room Light' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		example: 'Main light in living room',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({ description: 'Whether device is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({ description: 'Device controls', type: [CreateDeviceControlDto], isArray: true })
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"controls","reason":"Controls must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceControlDto)
	@UniqueControlNames({
		message: '[{"field":"controls.name","reason":"Each control name must be unique."}]',
	})
	controls?: CreateDeviceControlDto[];

	@ApiPropertyOptional({ description: 'Device channels', type: [CreateDeviceChannelDto], isArray: true })
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"channels","reason":"Channels must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceChannelDto)
	channels?: CreateDeviceChannelDto[];
}

@ApiSchema({ name: 'DevicesModuleReqCreateDevice' })
export class ReqCreateDeviceDto {
	@ApiProperty({ description: 'Device data', type: () => CreateDeviceDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceDto)
	data: CreateDeviceDto;
}
