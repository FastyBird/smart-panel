import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceCategory } from '../../../modules/devices/devices.constants';

import { HomeyCapabilityType } from './homey-capability.model';

export enum HomeyDeviceSupportState {
	SUPPORTED = 'supported',
	UNSUPPORTED = 'unsupported',
	CONFLICTED = 'conflicted',
}

export enum HomeyDeviceSupportReason {
	NO_DEVICE_MAPPING = 'no_device_mapping',
	NO_CHANNEL_MAPPING = 'no_channel_mapping',
	NO_PROPERTY_MAPPING = 'no_property_mapping',
	NO_COMPATIBLE_PROPERTY_MAPPING = 'no_compatible_property_mapping',
	DEVICE_MAPPING_CONFLICT = 'device_mapping_conflict',
	CHANNEL_MAPPING_CONFLICT = 'channel_mapping_conflict',
	PROPERTY_MAPPING_CONFLICT = 'property_mapping_conflict',
}

@ApiSchema({ name: 'DevicesHomeyPluginDataCapabilitySummary' })
export class HomeyCapabilitySummaryModel {
	@ApiProperty({ description: 'Full Homey capability identifier, including any instance suffix' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ name: 'base_id', description: 'Base capability identifier used for mapping lookup' })
	@Expose({ name: 'base_id' })
	@IsString()
	baseId: string;

	@ApiProperty({ description: 'Normalized capability value type', enum: HomeyCapabilityType })
	@Expose()
	@IsEnum(HomeyCapabilityType)
	type: HomeyCapabilityType;

	@ApiPropertyOptional({ description: 'Normalized capability unit', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	unit: string | null;

	@ApiProperty({ description: 'Whether the capability can be read' })
	@Expose()
	@IsBoolean()
	readable: boolean;

	@ApiProperty({ description: 'Whether the capability can be controlled' })
	@Expose()
	@IsBoolean()
	writable: boolean;

	@ApiPropertyOptional({ description: 'Capability availability when Homey reports it', nullable: true })
	@Expose()
	@IsOptional()
	@IsBoolean()
	available: boolean | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataInventoryDevice' })
export class HomeyInventoryDeviceModel {
	@ApiProperty({ description: 'Authoritative Homey device identifier' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Homey device display name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Normalized Homey device class' })
	@Expose()
	@IsString()
	class: string;

	@ApiPropertyOptional({ name: 'zone_id', description: 'Homey zone identifier', nullable: true })
	@Expose({ name: 'zone_id' })
	@IsOptional()
	@IsString()
	zoneId: string | null;

	@ApiPropertyOptional({ name: 'zone_name', description: 'Homey zone display name', nullable: true })
	@Expose({ name: 'zone_name' })
	@IsOptional()
	@IsString()
	zoneName: string | null;

	@ApiProperty({ name: 'zone_path', description: 'Ordered root-to-leaf Homey zone names', type: [String] })
	@Expose({ name: 'zone_path' })
	@IsArray()
	@IsString({ each: true })
	zonePath: string[];

	@ApiProperty({ description: 'Whether Homey currently reports the device as available' })
	@Expose()
	@IsBoolean()
	available: boolean;

	@ApiPropertyOptional({ name: 'driver_id', description: 'Normalized Homey driver identifier', nullable: true })
	@Expose({ name: 'driver_id' })
	@IsOptional()
	@IsString()
	driverId: string | null;

	@ApiPropertyOptional({ description: 'Normalized manufacturer metadata', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer: string | null;

	@ApiPropertyOptional({ description: 'Normalized model metadata', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiProperty({ type: [HomeyCapabilitySummaryModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyCapabilitySummaryModel)
	capabilities: HomeyCapabilitySummaryModel[];

	@ApiProperty({ name: 'support_state', description: 'Built-in mapping support state', enum: HomeyDeviceSupportState })
	@Expose({ name: 'support_state' })
	@IsEnum(HomeyDeviceSupportState)
	supportState: HomeyDeviceSupportState;

	@ApiProperty({
		name: 'support_reasons',
		description: 'Stable reason codes when built-in mapping support is unavailable or conflicted',
		enum: HomeyDeviceSupportReason,
		isArray: true,
	})
	@Expose({ name: 'support_reasons' })
	@IsArray()
	@IsEnum(HomeyDeviceSupportReason, { each: true })
	supportReasons: HomeyDeviceSupportReason[];

	@ApiPropertyOptional({
		name: 'suggested_category',
		description: 'Suggested Smart Panel device category from the resolved built-in mapping',
		enum: DeviceCategory,
		nullable: true,
	})
	@Expose({ name: 'suggested_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({ description: 'Whether a Homey plugin device with this identifier already exists in Smart Panel' })
	@Expose()
	@IsBoolean()
	adopted: boolean;

	@ApiPropertyOptional({
		name: 'adopted_device_id',
		description: 'Smart Panel device identifier when adopted',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'adopted_device_id' })
	@IsOptional()
	@IsString()
	adoptedDeviceId: string | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginResInventoryDevices' })
export class HomeyInventoryDevicesResponseModel extends BaseSuccessResponseModel<HomeyInventoryDeviceModel[]> {
	@ApiProperty({ type: [HomeyInventoryDeviceModel] })
	@Expose()
	declare data: HomeyInventoryDeviceModel[];
}

@ApiSchema({ name: 'DevicesHomeyPluginResInventoryDevice' })
export class HomeyInventoryDeviceResponseModel extends BaseSuccessResponseModel<HomeyInventoryDeviceModel> {
	@ApiProperty({ type: HomeyInventoryDeviceModel })
	@Expose()
	declare data: HomeyInventoryDeviceModel;
}
