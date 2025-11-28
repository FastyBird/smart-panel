import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayMinSize,
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDate,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataState' })
export class HomeAssistantStateModel {
	@ApiProperty({
		description: 'Home Assistant entity ID',
		type: 'string',
		example: 'light.living_room',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiProperty({
		description: 'Current state of the entity',
		type: 'string',
		example: 'on',
	})
	@Expose()
	@IsString()
	state: string;

	@ApiProperty({
		description: 'Dynamic attributes of the entity',
		example: { brightness: 255, color_temp: 370 },
	})
	@Expose()
	@IsObject()
	attributes: Record<string, unknown>; // Dynamic attributes

	@ApiProperty({
		description: 'Timestamp when the state last changed',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'last_changed',
	})
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

	@ApiProperty({
		description: 'Timestamp when the state was last reported',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'last_reported',
	})
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

	@ApiProperty({
		description: 'Timestamp when the state was last updated',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'last_updated',
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

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataDiscoveredDevice' })
export class HomeAssistantDiscoveredDeviceModel {
	@ApiProperty({
		description: 'Device identifier',
		type: 'string',
		example: 'living_room_light',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Device name',
		type: 'string',
		example: 'Living Room Light',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'List of entity IDs associated with this device',
		type: 'array',
		items: { type: 'string' },
		example: ['light.living_room', 'sensor.living_room_temperature'],
	})
	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	entities: string[];

	@ApiPropertyOptional({
		description: 'ID of the adopted device in the system',
		type: 'string',
		nullable: true,
		example: null,
		name: 'adopted_device_id',
	})
	@Expose({ name: 'adopted_device_id' })
	@IsString()
	@IsOptional()
	adoptedDeviceId: string | null = null;

	@ApiProperty({
		description: 'List of entity states',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantStateModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantStateModel)
	states: HomeAssistantStateModel[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataEntityRegistryResult' })
export class HomeAssistantEntityRegistryResultModel {
	@ApiProperty({
		description: 'Entity registry identifier',
		type: 'string',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Home Assistant entity ID',
		type: 'string',
		example: 'light.living_room',
		name: 'entity_id',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entityId: string;

	@ApiPropertyOptional({
		description: 'Area identifier',
		type: 'string',
		nullable: true,
		example: 'living_room',
		name: 'area_id',
	})
	@Expose({ name: 'area_id' })
	@IsString()
	@IsOptional()
	areaId: string | null = null;

	@ApiPropertyOptional({
		description: 'Device identifier',
		type: 'string',
		nullable: true,
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
		name: 'device_id',
	})
	@Expose({ name: 'device_id' })
	@IsString()
	@IsOptional()
	deviceId: string | null = null;

	@ApiPropertyOptional({
		description: 'Entity category',
		type: 'string',
		nullable: true,
		example: 'config',
		name: 'entity_category',
	})
	@Expose({ name: 'entity_category' })
	@IsString()
	@IsOptional()
	entityCategory: string | null = null;

	@ApiProperty({
		description: 'Whether the entity has an entity name',
		type: 'boolean',
		example: false,
		name: 'has_entity_name',
	})
	@Expose({ name: 'has_entity_name' })
	@IsBoolean()
	hasEntityName: boolean = false;

	@ApiPropertyOptional({
		description: 'Entity icon',
		type: 'string',
		nullable: true,
		example: 'mdi:lightbulb',
	})
	@Expose()
	@IsString()
	@IsOptional()
	icon: string | null = null;

	@ApiPropertyOptional({
		description: 'Entity name',
		type: 'string',
		nullable: true,
		example: 'Living Room Light',
	})
	@Expose()
	@IsString()
	@IsOptional()
	name: string | null = null;

	@ApiPropertyOptional({
		description: 'Original entity name',
		type: 'string',
		nullable: true,
		example: 'Living Room Light',
		name: 'original_name',
	})
	@Expose({ name: 'original_name' })
	@IsString()
	@IsOptional()
	originalName: string | null = null;

	@ApiProperty({
		description: 'Unique entity identifier',
		type: 'string',
		example: 'aa:bb:cc:dd:ee:ff',
		name: 'unique_id',
	})
	@Expose({ name: 'unique_id' })
	@IsString()
	uniqueId: string;

	@ApiProperty({
		description: 'Timestamp when the entity was created',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'created_at',
	})
	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | number | Date; createdAt?: string | number | Date } }) => {
			const value: string | number | Date = obj.created_at || obj.createdAt;
			return typeof value === 'string'
				? new Date(value)
				: typeof value === 'number'
					? new Date(value < 10_000_000_000 ? value * 1000 : value)
					: value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;

	@ApiPropertyOptional({
		description: 'Timestamp when the entity was last modified',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'modified_at',
	})
	@Expose({ name: 'modified_at' })
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { modified_at?: string | number | Date; modifiedAt?: string | number | Date } }) => {
			const value: string | number | Date = obj.modified_at || obj.modifiedAt;
			return typeof value === 'string'
				? new Date(value)
				: typeof value === 'number'
					? new Date(value < 10_000_000_000 ? value * 1000 : value)
					: value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	modifiedAt?: Date | string;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHomeAssistantEntityRegistry' })
export class HomeAssistantEntityRegistryModel {
	@ApiProperty({
		description: 'Response identifier',
		type: 'string',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Response type',
		type: 'string',
		example: 'result',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Whether the request was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiProperty({
		description: 'List of entity registry results',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantEntityRegistryResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantEntityRegistryResultModel)
	result: HomeAssistantEntityRegistryResultModel[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataDeviceRegistryResult' })
export class HomeAssistantDeviceRegistryResultModel {
	@ApiProperty({
		description: 'Device registry identifier',
		type: 'string',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiPropertyOptional({
		description: 'Area identifier',
		type: 'string',
		nullable: true,
		example: 'living_room',
		name: 'area_id',
	})
	@Expose({ name: 'area_id' })
	@IsString()
	@IsOptional()
	areaId: string | null;

	@ApiProperty({
		description: 'Device name',
		type: 'string',
		example: 'Living Room Light',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'User-defined device name',
		type: 'string',
		nullable: true,
		example: 'My Custom Light Name',
		name: 'name_by_user',
	})
	@Expose({ name: 'name_by_user' })
	@IsString()
	@IsOptional()
	nameByUser: string | null;

	@ApiPropertyOptional({
		description: 'Device manufacturer',
		type: 'string',
		nullable: true,
		example: 'Philips',
	})
	@Expose()
	@IsString()
	@IsOptional()
	manufacturer: string | null;

	@ApiPropertyOptional({
		description: 'Device model',
		type: 'string',
		nullable: true,
		example: 'Hue Color Bulb',
	})
	@Expose()
	@IsString()
	@IsOptional()
	model: string | null;

	@ApiPropertyOptional({
		description: 'Device model identifier',
		type: 'string',
		nullable: true,
		example: 'LCT015',
		name: 'model_id',
	})
	@Expose({ name: 'model_id' })
	@IsString()
	@IsOptional()
	modelId: string | null;

	@ApiPropertyOptional({
		description: 'Hardware version',
		type: 'string',
		nullable: true,
		example: '1.0',
		name: 'hw_version',
	})
	@Expose({ name: 'hw_version' })
	@IsString()
	@IsOptional()
	hwVersion: string | null;

	@ApiPropertyOptional({
		description: 'Software version',
		type: 'string',
		nullable: true,
		example: '1.2.3',
		name: 'sw_version',
	})
	@Expose({ name: 'sw_version' })
	@IsString()
	@IsOptional()
	swVersion: string | null;

	@ApiPropertyOptional({
		description: 'Serial number',
		type: 'string',
		nullable: true,
		example: 'SN123456789',
		name: 'serial_number',
	})
	@Expose({ name: 'serial_number' })
	@IsString()
	@IsOptional()
	serialNumber: string | null;

	@ApiPropertyOptional({
		description: 'Device connections as tuples of connection type and identifier',
		type: 'array',
		items: { type: 'array', items: { type: 'string' } },
		example: [['mac', 'aa:bb:cc:dd:ee:ff']],
	})
	@Expose()
	@IsArray()
	@IsOptional()
	@ArrayMinSize(0)
	@IsArray({ each: true })
	connections: [string, string][] = [];

	@ApiProperty({
		description: 'Timestamp when the device was created',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'created_at',
	})
	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | number | Date; createdAt?: string | number | Date } }) => {
			const value: string | number | Date = obj.created_at || obj.createdAt;
			return typeof value === 'string'
				? new Date(value)
				: typeof value === 'number'
					? new Date(value < 10_000_000_000 ? value * 1000 : value)
					: value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date;

	@ApiPropertyOptional({
		description: 'Timestamp when the device was last modified',
		type: 'string',
		format: 'date-time',
		example: '2023-10-15T14:30:00.000Z',
		name: 'modified_at',
	})
	@Expose({ name: 'modified_at' })
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { modified_at?: string | number | Date; modifiedAt?: string | number | Date } }) => {
			const value: string | number | Date = obj.modified_at || obj.modifiedAt;
			return typeof value === 'string'
				? new Date(value)
				: typeof value === 'number'
					? new Date(value < 10_000_000_000 ? value * 1000 : value)
					: value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	modifiedAt?: Date | string;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataHomeAssistantDeviceRegistry' })
export class HomeAssistantDeviceRegistryModel {
	@ApiProperty({
		description: 'Response identifier',
		type: 'string',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Response type',
		type: 'string',
		example: 'result',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Whether the request was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiProperty({
		description: 'List of device registry results',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantDeviceRegistryResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantDeviceRegistryResultModel)
	result: HomeAssistantDeviceRegistryResultModel[];
}
