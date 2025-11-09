import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDate,
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

export class RegisteredDevicesModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class RegisteredChannelsModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class UpdatesPerMinModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class UpdatesTodayModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class OnlineNowModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class ModuleStatsModel {
	@Expose({ name: 'registered_devices' })
	@ValidateNested()
	@Type(() => RegisteredDevicesModel)
	registeredDevices: RegisteredDevicesModel;

	@Expose({ name: 'registered_channels' })
	@ValidateNested()
	@Type(() => RegisteredChannelsModel)
	registeredChannels: RegisteredChannelsModel;

	@Expose({ name: 'updates_per_min' })
	@ValidateNested()
	@Type(() => UpdatesPerMinModel)
	updatesPerMin: UpdatesPerMinModel;

	@Expose({ name: 'updates_today' })
	@ValidateNested()
	@Type(() => UpdatesTodayModel)
	updatesToday: UpdatesTodayModel;

	@Expose({ name: 'online_now' })
	@ValidateNested()
	@Type(() => OnlineNowModel)
	onlineNow: OnlineNowModel;
}
