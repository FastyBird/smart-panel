import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelCategory } from '../devices.constants';
import { UniqueControlNames } from '../validators/unique-control-names-constraint.validator';

import { CreateDeviceChannelControlDto } from './create-device-channel-control.dto';
import { CreateDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesModuleCreateDeviceChannel' })
export class CreateDeviceChannelDto {
	@ApiPropertyOptional({
		description: 'Channel ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Channel type', type: 'string', example: 'generic' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported channel type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported channel type."}]',
	})
	type: string;

	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		example: ChannelCategory.GENERIC,
	})
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	@IsEnum(ChannelCategory, {
		message: '[{"field":"category","reason":"Category must be a valid channel category."}]',
	})
	category: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Channel identifier',
		type: 'string',
		example: 'main',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string;

	@ApiProperty({ description: 'Channel name', type: 'string', example: 'Main Channel' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Channel description',
		type: 'string',
		nullable: true,
		example: 'Main device channel',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Channel controls',
		type: [CreateDeviceChannelControlDto],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"controls","reason":"Controls must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceChannelControlDto)
	@UniqueControlNames({
		message: '[{"field":"controls.name","reason":"Each control name must be unique."}]',
	})
	controls?: CreateDeviceChannelControlDto[];

	@ApiPropertyOptional({
		description: 'Channel properties',
		type: [CreateDeviceChannelPropertyDto],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"properties","reason":"Properties must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateDeviceChannelPropertyDto)
	properties?: CreateDeviceChannelPropertyDto[];
}

@ApiSchema({ name: 'DevicesModuleReqCreateDeviceChannel' })
export class ReqCreateDeviceChannelDto {
	@ApiProperty({ description: 'Device channel data', type: CreateDeviceChannelDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceChannelDto)
	data: CreateDeviceChannelDto;
}
