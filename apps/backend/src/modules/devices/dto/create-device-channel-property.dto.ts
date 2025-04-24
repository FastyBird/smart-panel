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
import { DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';

type ReqCreateChannelProperty = components['schemas']['DevicesModuleReqCreateChannelProperty'];
type CreateChannelProperty = components['schemas']['DevicesModuleCreateChannelProperty'];

export class CreateDeviceChannelPropertyDto implements CreateChannelProperty {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category: PropertyCategory;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	name?: string | null;

	@Expose()
	@IsArray()
	@IsEnum(PermissionType, {
		each: true,
		message: '[{"field":"permissions","reason":"Each permission must be a valid permission type."}]',
	})
	@ArrayNotEmpty({ message: '[{"field":"permissions","reason":"Permissions array cannot be empty."}]' })
	permissions: PermissionType[];

	@Expose()
	@IsNotEmpty({
		message: '[{"field":"data_type","reason":"Data type must be a valid data type."}]',
	})
	@IsEnum(DataTypeType, {
		message: '[{"field":"data_type","reason":"Data type must be a valid data type."}]',
	})
	data_type: DataTypeType;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"format","reason":"Format must be an array."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'string'))
	@IsString({ each: true, message: '[{"field":"format","reason":"Each format value must be a string."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'number'))
	@IsNumber({}, { each: true, message: '[{"field":"format","reason":"Each format value must be a number."}]' })
	@ValidateIf((_, value) => value !== null)
	format?: string[] | number[] | null;

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

	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"step","reason":"Step must be a valid number."}]' })
	step?: number;

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

export class ReqCreateDeviceChannelPropertyDto implements ReqCreateChannelProperty {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceChannelPropertyDto)
	data: CreateDeviceChannelPropertyDto;
}
