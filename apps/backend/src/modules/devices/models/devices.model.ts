import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDate,
	IsDateString,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';

@ApiSchema({ name: 'DevicesModuleDataDeviceChannelSpec' })
export class DeviceChannelSpecModel {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		example: ChannelCategory.GENERIC,
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Whether the channel is required',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	required: boolean;

	@ApiProperty({
		description: 'Whether multiple instances of the channel are allowed',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	multiple: boolean;
}

@ApiSchema({ name: 'DevicesModuleDataDeviceSpec' })
export class DeviceSpecModel {
	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
		example: DeviceCategory.GENERIC,
	})
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;

	@ApiProperty({
		description: 'Device channel specifications',
		type: 'array',
		items: { $ref: getSchemaPath(DeviceChannelSpecModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceChannelSpecModel)
	channels: DeviceChannelSpecModel[];
}

/**
 * Data type variant for polymorphic properties (e.g., brightness can be percentage or level)
 */
@ApiSchema({ name: 'DevicesModuleDataTypeVariant' })
export class DataTypeVariantModel {
	@ApiProperty({
		description: 'Variant identifier',
		type: 'string',
		example: 'percentage',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		name: 'data_type',
		description: 'Data type for this variant',
		enum: DataTypeType,
		example: DataTypeType.UCHAR,
	})
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	data_type: DataTypeType;

	@ApiPropertyOptional({
		description: 'Unit for this variant',
		type: 'string',
		nullable: true,
		example: '%',
	})
	@Expose()
	@IsOptional()
	@IsString()
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Format constraints for this variant',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsArray()
	format?: string[] | number[] | null;

	@ApiPropertyOptional({
		description: 'Step value for numeric variants',
		type: 'number',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	step?: number | null;

	@Expose()
	@IsOptional()
	description?: { en: string } | null;
}

@ApiSchema({ name: 'DevicesModuleDataChannelPropertySpec' })
export class ChannelPropertySpecModel {
	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
		example: PropertyCategory.GENERIC,
	})
	@Expose()
	@IsEnum(PropertyCategory)
	category: PropertyCategory;

	@ApiProperty({
		description: 'Whether the property is required',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	required: boolean;

	@ApiProperty({
		description: 'Property permissions',
		type: 'array',
		items: { type: 'string', enum: Object.values(PermissionType) },
		example: [PermissionType.READ_ONLY, PermissionType.READ_WRITE],
	})
	@Expose()
	@IsEnum(PermissionType, { each: true })
	@ArrayNotEmpty()
	permissions: PermissionType[];

	@ApiPropertyOptional({
		name: 'data_type',
		description: 'Property data type (for single-type properties)',
		enum: DataTypeType,
		example: DataTypeType.STRING,
	})
	@Expose()
	@ValidateIf((o: ChannelPropertySpecModel) => !o.data_types || o.data_types.length === 0)
	@IsEnum(DataTypeType)
	data_type?: DataTypeType;

	@ApiPropertyOptional({
		name: 'data_types',
		description: 'Property data type variants (for polymorphic properties)',
		type: 'array',
		items: { $ref: getSchemaPath(DataTypeVariantModel) },
	})
	@Expose({ name: 'data_types' })
	@ValidateIf((o: ChannelPropertySpecModel) => !o.data_type)
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DataTypeVariantModel)
	data_types?: DataTypeVariantModel[];

	@ApiProperty({
		description: 'Property unit',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsString()
	unit: string | null = null;

	@ApiProperty({
		description: 'Property format constraints (array of strings or numbers)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
		nullable: true,
		example: ['on', 'off'],
	})
	@Expose()
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

	@ApiProperty({
		description: 'Invalid value indicator',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: null,
	})
	@Expose()
	invalid: string | boolean | number | null = null;

	@ApiProperty({
		description: 'Property step value for numeric types',
		type: 'number',
		nullable: true,
		example: 0.1,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	step: number | null = null;
}

@ApiSchema({ name: 'DevicesModuleDataChannelSpec' })
export class ChannelSpecModel {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		example: ChannelCategory.GENERIC,
	})
	@Expose()
	@IsEnum(ChannelCategory)
	category: ChannelCategory;

	@ApiProperty({
		description: 'Channel property specifications',
		type: 'array',
		items: { $ref: getSchemaPath(ChannelPropertySpecModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChannelPropertySpecModel)
	properties: ChannelPropertySpecModel[];
}

@ApiSchema({ name: 'DevicesModuleDataRegisteredDevices' })
export class RegisteredDevicesModel {
	@ApiProperty({
		description: 'Number of registered devices',
		type: 'number',
		example: 10,
	})
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DevicesModuleDataRegisteredChannels' })
export class RegisteredChannelsModel {
	@ApiProperty({
		description: 'Number of registered channels',
		type: 'number',
		example: 25,
	})
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DevicesModuleDataUpdatesPerMin' })
export class UpdatesPerMinModel {
	@ApiProperty({
		description: 'Number of updates per minute',
		type: 'number',
		example: 5,
	})
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DevicesModuleDataUpdatesToday' })
export class UpdatesTodayModel {
	@ApiProperty({
		description: 'Total number of updates today',
		type: 'number',
		example: 150,
	})
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DevicesModuleDataOnlineNow' })
export class OnlineNowModel {
	@ApiProperty({
		description: 'Number of devices currently online',
		type: 'number',
		example: 8,
	})
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ value }: { value: { toNanoISOString?: () => string; _nanoISO?: string } | string | Date | null }) => {
			if (!value) {
				return null;
			}

			if (typeof value === 'string') {
				return new Date(value);
			}

			if (value instanceof Date) {
				return new Date(value.getTime());
			}

			if (typeof value?.toNanoISOString === 'function') {
				return new Date(value.toNanoISOString());
			}

			if (typeof value === 'object' && typeof value._nanoISO === 'string') {
				return new Date(value._nanoISO);
			}

			return null;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DevicesModuleDataModuleStats' })
export class ModuleStatsModel {
	@ApiProperty({
		name: 'registered_devices',
		description: 'Registered devices statistics',
		type: () => RegisteredDevicesModel,
	})
	@Expose({ name: 'registered_devices' })
	@ValidateNested()
	@Type(() => RegisteredDevicesModel)
	registeredDevices: RegisteredDevicesModel;

	@ApiProperty({
		name: 'registered_channels',
		description: 'Registered channels statistics',
		type: () => RegisteredChannelsModel,
	})
	@Expose({ name: 'registered_channels' })
	@ValidateNested()
	@Type(() => RegisteredChannelsModel)
	registeredChannels: RegisteredChannelsModel;

	@ApiProperty({
		name: 'updates_per_min',
		description: 'Updates per minute statistics',
		type: () => UpdatesPerMinModel,
	})
	@Expose({ name: 'updates_per_min' })
	@ValidateNested()
	@Type(() => UpdatesPerMinModel)
	updatesPerMin: UpdatesPerMinModel;

	@ApiProperty({
		name: 'updates_today',
		description: 'Total updates today statistics',
		type: () => UpdatesTodayModel,
	})
	@Expose({ name: 'updates_today' })
	@ValidateNested()
	@Type(() => UpdatesTodayModel)
	updatesToday: UpdatesTodayModel;

	@ApiProperty({
		name: 'online_now',
		description: 'Currently online devices statistics',
		type: OnlineNowModel,
	})
	@Expose({ name: 'online_now' })
	@ValidateNested()
	@Type(() => OnlineNowModel)
	onlineNow: OnlineNowModel;
}

@ApiSchema({ name: 'DevicesModuleDataTimeseriesPoint' })
export class TimeseriesPointModel {
	@ApiProperty({
		description: 'Timestamp of the data point',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose()
	@IsDateString()
	time: string;

	@ApiProperty({
		description: 'Value of the data point',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: 25.5,
	})
	@Expose()
	value: string | number | boolean;
}

@ApiSchema({ name: 'DevicesModuleDataPropertyTimeseries' })
export class PropertyTimeseriesModel {
	@ApiProperty({
		description: 'Property UUID',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsUUID()
	property: string;

	@ApiProperty({
		description: 'Start timestamp of the timeseries range',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T00:00:00Z',
	})
	@Expose()
	@IsDateString()
	from: string;

	@ApiProperty({
		description: 'End timestamp of the timeseries range',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T23:59:59Z',
	})
	@Expose()
	@IsDateString()
	to: string;

	@ApiPropertyOptional({
		description: 'Time bucket aggregation interval',
		type: 'string',
		nullable: true,
		example: '1h',
	})
	@Expose()
	@IsOptional()
	@IsString()
	bucket: string | null;

	@ApiProperty({
		description: 'Array of timeseries data points',
		type: 'array',
		items: { $ref: getSchemaPath(TimeseriesPointModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	points: TimeseriesPointModel[];
}
