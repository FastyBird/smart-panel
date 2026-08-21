import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayNotEmpty,
	IsArray,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesHomeyPluginAdoptDevice' })
export class HomeyAdoptDeviceDto {
	@ApiProperty({
		name: 'device_id',
		description: 'Authoritative full Homey device identifier to adopt',
		type: 'string',
	})
	@Expose({ name: 'device_id' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	deviceId: string;

	@ApiPropertyOptional({
		name: 'device_category',
		description: 'Optional Smart Panel category selected from the latest mapping preview',
		enum: DeviceCategory,
	})
	@Expose({ name: 'device_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	deviceCategory?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Optional Smart Panel display name; the current Homey name is used when omitted',
		type: 'string',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name?: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginBatchAdoptDevices' })
export class HomeyBatchAdoptDevicesDto {
	@ApiProperty({
		description: 'Homey devices to adopt independently in request order',
		type: [HomeyAdoptDeviceDto],
		minItems: 1,
		maxItems: 100,
	})
	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => HomeyAdoptDeviceDto)
	devices: HomeyAdoptDeviceDto[];
}
