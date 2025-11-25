import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';

type ReqCreateChannelProperty = components['schemas']['DevicesModuleReqCreateChannelProperty'];
type CreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];

@ApiSchema('DevicesModuleCreateChannelProperty')
export class CreateDeviceChannelPropertyDto implements CreateChannelProperty {
	@ApiPropertyOptional({
		description: 'Property ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Property type', type: 'string', example: 'dynamic' })
	@Expose()
	@IsNotEmpty({
		message:
			'[{"field":"type","reason":"Type must be a valid string representing a supported channel property type."}]',
	})
	@IsString({
		message:
			'[{"field":"type","reason":"Type must be a valid string representing a supported channel property type."}]',
	})
	type: string;

	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
		example: PropertyCategory.GENERIC,
	})
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category: PropertyCategory;

	@ApiPropertyOptional({
		description: 'Property identifier',
		type: 'string',
		example: 'temperature',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel property unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel property unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string;

	@ApiPropertyOptional({
		description: 'Property name',
		type: 'string',
		nullable: true,
		example: 'Temperature',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	name?: string | null;

	@ApiProperty({
		description: 'Property permissions',
		enum: PermissionType,
		isArray: true,
		example: [PermissionType.READ_ONLY],
	})
	@Expose()
	@IsArray()
	@IsEnum(PermissionType, {
		each: true,
		message: '[{"field":"permissions","reason":"Each permission must be a valid permission type."}]',
	})
	@ArrayNotEmpty({ message: '[{"field":"permissions","reason":"Permissions array cannot be empty."}]' })
	permissions: PermissionType[];

	@ApiProperty({
		description: 'Property data type',
		name: 'data_type',
		enum: DataTypeType,
		example: DataTypeType.FLOAT,
	})
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"data_type","reason":"Data type must be a valid data type."}]',
	})
	@IsEnum(DataTypeType, {
		message: '[{"field":"data_type","reason":"Data type must be a valid data type."}]',
	})
	data_type: DataTypeType;

	@ApiPropertyOptional({
		description: 'Property unit',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Property format',
		type: 'array',
		nullable: true,
		example: [0, 100],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"format","reason":"Format must be an array."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'string'))
	@IsString({ each: true, message: '[{"field":"format","reason":"Each format value must be a string."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'number'))
	@IsNumber({}, { each: true, message: '[{"field":"format","reason":"Each format value must be a number."}]' })
	@ValidateIf((_, value) => value !== null)
	format?: string[] | number[] | null;

	@ApiPropertyOptional({
		description: 'Property invalid value',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'string')
	@IsString({ message: '[{"field":"invalid","reason":"Invalid must be a string."}]' })
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'number')
	@IsNumber({}, { message: '[{"field":"invalid","reason":"Invalid must be a number."}]' })
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'boolean')
	@IsBoolean({ message: '[{"field":"invalid","reason":"Invalid must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null)
	invalid?: string | number | boolean | null;

	@ApiPropertyOptional({
		description: 'Property step value',
		type: 'number',
		example: 0.1,
	})
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"step","reason":"Step must be a valid number."}]' })
	step?: number;

	@ApiPropertyOptional({
		description: 'Property value',
		nullable: true,
		example: 22.5,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'string')
	@IsString({ message: '[{"field":"value","reason":"Value must be a string."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'number')
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'boolean')
	@IsBoolean({ message: '[{"field":"value","reason":"Value must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null)
	value?: string | number | boolean | null;
}

@ApiSchema('DevicesModuleReqCreateChannelProperty')
export class ReqCreateDeviceChannelPropertyDto implements ReqCreateChannelProperty {
	@ApiProperty({ description: 'Channel property data', type: CreateDeviceChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceChannelPropertyDto)
	data: CreateDeviceChannelPropertyDto;
}
