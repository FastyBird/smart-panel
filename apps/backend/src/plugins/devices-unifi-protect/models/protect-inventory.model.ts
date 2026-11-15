import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { PROTECT_MODEL_KEYS, ProtectModelKey } from '../mappings/mapping.types';

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataInventoryDevice' })
export class ProtectInventoryDeviceModel {
	@ApiProperty({ description: 'UniFi Protect device identifier' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		name: 'model_key',
		description: 'UniFi Protect device kind',
		enum: PROTECT_MODEL_KEYS,
	})
	@Expose({ name: 'model_key' })
	@IsString()
	modelKey: ProtectModelKey;

	@ApiProperty({ description: 'Device name as shown in UniFi Protect' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Hardware model reported by the console', nullable: true, type: 'string' })
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiPropertyOptional({ description: 'Device MAC address', nullable: true, type: 'string' })
	@Expose()
	@IsOptional()
	@IsString()
	mac: string | null;

	@ApiProperty({ description: 'Device state reported by the console, for example CONNECTED' })
	@Expose()
	@IsString()
	state: string;

	@ApiProperty({ description: 'Whether the console reports the device as connected' })
	@Expose()
	@IsBoolean()
	connected: boolean;

	@ApiProperty({ description: 'Whether a built-in mapping supports this device' })
	@Expose()
	@IsBoolean()
	supported: boolean;

	@ApiPropertyOptional({
		name: 'mapping_name',
		description: 'Name of the built-in device mapping, when supported',
		nullable: true,
		type: 'string',
	})
	@Expose({ name: 'mapping_name' })
	@IsOptional()
	@IsString()
	mappingName: string | null;

	@ApiPropertyOptional({
		name: 'suggested_category',
		description: 'Suggested Smart Panel device category from the built-in mapping',
		enum: DeviceCategory,
		nullable: true,
	})
	@Expose({ name: 'suggested_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({ description: 'Smart Panel device identifier, <console MAC>:<Protect device id>' })
	@Expose()
	@IsString()
	identifier: string;

	@ApiProperty({ description: 'Whether a UniFi Protect device with this identifier already exists in Smart Panel' })
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

@ApiSchema({ name: 'DevicesUnifiProtectPluginResInventoryDevices' })
export class ProtectInventoryDevicesResponseModel extends BaseSuccessResponseModel<ProtectInventoryDeviceModel[]> {
	@ApiProperty({ type: [ProtectInventoryDeviceModel] })
	@Expose()
	declare data: ProtectInventoryDeviceModel[];
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResInventoryDevice' })
export class ProtectInventoryDeviceResponseModel extends BaseSuccessResponseModel<ProtectInventoryDeviceModel> {
	@ApiProperty({ type: ProtectInventoryDeviceModel })
	@Expose()
	declare data: ProtectInventoryDeviceModel;
}
