import { Expose, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';

export class DeviceChannelSpecModel {
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@Expose()
	@IsBoolean()
	required: boolean;

	@Expose()
	@IsBoolean()
	multiple: boolean;
}

export class DeviceSpecModel {
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceChannelSpecModel)
	channels: DeviceChannelSpecModel[];
}

export class ChannelPropertySpecModel {
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@Expose()
	@IsBoolean()
	required: boolean;

	@Expose()
	@IsEnum(PermissionType, { each: true })
	@ArrayNotEmpty()
	permissions: PermissionType[];

	@Expose()
	@IsEnum(DataTypeType)
	data_type: DataTypeType;

	@Expose()
	@IsOptional()
	@IsString()
	unit: string | null = null;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateIf((o: { format?: unknown[] }): boolean =>
		o.format?.every((item: unknown): boolean => typeof item === 'string'),
	)
	@IsString({ each: true })
	@ValidateIf((o: { format?: unknown[] }): boolean =>
		o.format?.every((item: unknown): boolean => typeof item === 'number'),
	)
	@IsNumber({}, { each: true })
	format: string[] | number[] | null = null;

	@Expose()
	@IsOptional()
	invalid: string | boolean | number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	step: number | null = null;
}

export class ChannelSpecModel {
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChannelPropertySpecModel)
	properties: ChannelPropertySpecModel[];
}
