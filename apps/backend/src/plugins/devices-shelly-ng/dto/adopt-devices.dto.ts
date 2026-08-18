import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

/**
 * A whole discovery result can be adopted at once, and a large installation
 * discovers a lot of devices, so the cap only guards against a request that
 * could not have come from the wizard.
 */
export const ADOPT_DEVICES_MAX = 500;

@ApiSchema({ name: 'DevicesShellyNgPluginAdoptDevice' })
export class AdoptDeviceDto {
	@ApiProperty({
		description: 'Shelly device identifier as reported by the device itself',
		type: 'string',
		example: 'shellyplus1pm-441793ad07bc',
	})
	@Expose()
	@IsString({ message: '[{"field":"identifier","reason":"Identifier must be a valid string."}]' })
	identifier: string;

	@ApiProperty({
		description: 'Address the device was discovered on',
		type: 'string',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString({ message: '[{"field":"hostname","reason":"Hostname must be a valid string."}]' })
	hostname: string;

	@ApiProperty({
		description: 'Name to give the adopted device',
		type: 'string',
		example: 'Kitchen light',
	})
	@Expose()
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name: string;

	@ApiProperty({
		description: 'Category to assign to the adopted device',
		enum: DeviceCategory,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsEnum(DeviceCategory, { message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	category: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Password for a device with authentication enabled',
		type: 'string',
		nullable: true,
		example: 'password123',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password must be a valid string."}]' })
	password?: string | null = null;
}

@ApiSchema({ name: 'DevicesShellyNgPluginAdoptDevices' })
export class AdoptDevicesDto {
	@ApiProperty({
		description: 'Devices to adopt',
		type: () => [AdoptDeviceDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"devices","reason":"Devices must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"devices","reason":"At least one device is required."}]' })
	@ArrayMaxSize(ADOPT_DEVICES_MAX, {
		message: `[{"field":"devices","reason":"At most ${ADOPT_DEVICES_MAX} devices can be adopted in one request."}]`,
	})
	@ValidateNested({ each: true })
	@Type(() => AdoptDeviceDto)
	devices: AdoptDeviceDto[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginReqAdoptDevices' })
export class ReqAdoptDevicesDto {
	@ApiProperty({ description: 'Adoption data', type: () => AdoptDevicesDto })
	@Expose()
	@ValidateNested()
	@Type(() => AdoptDevicesDto)
	data: AdoptDevicesDto;
}
