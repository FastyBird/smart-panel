import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDate,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

export class HomeAssistantStateModel {
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@Expose()
	@IsString()
	state: string;

	@Expose()
	@IsObject()
	attributes: Record<string, unknown>; // Dynamic attributes

	@Expose({ name: 'last_changed' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_changed?: string | Date; lastChanged?: string | Date } }) => {
			const value: string | Date = obj.last_changed || obj.lastChanged;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastChanged: Date;

	@Expose({ name: 'last_reported' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_reported?: string | Date; lastReported?: string | Date } }) => {
			const value: string | Date = obj.last_reported || obj.lastReported;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastReported: Date;

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

export class HomeAssistantDiscoveredDeviceModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	entities: string[];

	@Expose({ name: 'adopted_device_id' })
	@IsString()
	@IsOptional()
	adoptedDeviceId: string | null = null;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantStateModel)
	states: HomeAssistantStateModel[];
}

export class HomeAssistantEntityRegistryResponseResultModel {
	@Expose()
	@IsString()
	id: string;

	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@Expose({ name: 'area_id' })
	@IsString()
	@IsOptional()
	areaId: string | null;

	@Expose({ name: 'device_id' })
	@IsString()
	deviceId: string;

	@Expose({ name: 'entity_category' })
	@IsString()
	entityCategory: string;

	@Expose({ name: 'has_entity_name' })
	@IsBoolean()
	hasEntityName: boolean;

	@Expose()
	@IsString()
	@IsOptional()
	icon: string | null;

	@Expose()
	@IsString()
	@IsOptional()
	name: string | null;

	@Expose({ name: 'original_name' })
	@IsString()
	originalName: string;

	@Expose({ name: 'unique_id' })
	@IsString()
	uniqueId: string;

	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.created_at || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;

	@Expose({ name: 'modified_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { modified_at?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.modified_at || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	modifiedAt: Date;
}

export class HomeAssistantEntityRegistryResponseModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsBoolean()
	success: boolean;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantEntityRegistryResponseResultModel)
	result: HomeAssistantEntityRegistryResponseResultModel[];
}

export class DeviceConnection {
	@IsString()
	@Expose()
	type: string; // mac | bluetooth | zigbee | zwave | serial | usb | ethernet

	@IsString()
	@Expose()
	value: string;
}

export class HomeAssistantDeviceRegistryResponseResultModel {
	@Expose()
	@IsString()
	id: string;

	@Expose({ name: 'area_id' })
	@IsString()
	@IsOptional()
	areaId: string | null;

	@Expose()
	@IsString()
	name: string;

	@Expose({ name: 'name_by_user' })
	@IsString()
	@IsOptional()
	nameByUser: string | null;

	@Expose()
	@IsString()
	manufacturer: string;

	@Expose()
	@IsString()
	@IsOptional()
	model: string | null;

	@Expose({ name: 'model_id' })
	@IsString()
	@IsOptional()
	modelId: string | null;

	@Expose({ name: 'hw_version' })
	@IsString()
	@IsOptional()
	hwVersion: string | null;

	@Expose({ name: 'sw_version' })
	@IsString()
	@IsOptional()
	swVersion: string | null;

	@Expose({ name: 'serial_number' })
	@IsString()
	@IsOptional()
	serialNumber: string | null;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceConnection)
	connections: DeviceConnection[];

	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.created_at || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;

	@Expose({ name: 'modified_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { modified_at?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.modified_at || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	modifiedAt: Date;
}

export class HomeAssistantDeviceRegistryResponseModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsBoolean()
	success: boolean;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantDeviceRegistryResponseResultModel)
	result: HomeAssistantDeviceRegistryResponseResultModel[];
}
