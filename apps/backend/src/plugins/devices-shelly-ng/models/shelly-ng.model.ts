import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgSupportedDeviceComponent' })
export class ShellyNgSupportedDeviceComponentModel {
	@ApiProperty({
		description: 'Component type',
		example: 'switch',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Component IDs',
		isArray: true,
		example: [0, 1],
	})
	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgSupportedDeviceSystemComponent' })
export class ShellyNgSupportedDeviceSystemComponentModel {
	@ApiProperty({
		description: 'System component type',
		example: 'wifi',
	})
	@Expose()
	@IsString()
	type: string;
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgSupportedDevice' })
export class ShellyNgSupportedDeviceModel {
	@ApiProperty({
		description: 'Device group',
		example: 'gen2',
	})
	@Expose()
	@IsString()
	group: string;

	@ApiProperty({
		description: 'Device name',
		example: 'Shelly Plus 1',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Supported device models',
		isArray: true,
		example: ['SNSW-001P16EU', 'SNSW-001P16UK'],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	models: string[];

	@ApiProperty({
		description: 'Device categories',
		enum: DeviceCategory,
		isArray: true,
		example: [DeviceCategory.GENERIC],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	categories: DeviceCategory[];

	@ApiProperty({
		description: 'Device components',
		type: () => ShellyNgSupportedDeviceComponentModel,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceComponentModel)
	components: ShellyNgSupportedDeviceComponentModel[];

	@ApiProperty({
		description: 'System components',
		type: () => ShellyNgSupportedDeviceSystemComponentModel,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceSystemComponentModel)
	system: ShellyNgSupportedDeviceSystemComponentModel[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgDeviceInfoComponent' })
export class ShellyNgDeviceInfoComponentModel {
	@ApiProperty({
		description: 'Component type',
		example: 'switch',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Component IDs',
		isArray: true,
		example: [0, 1],
	})
	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgDeviceInfoAuthentication' })
export class ShellyNgDeviceInfoAuthenticationModel {
	@ApiPropertyOptional({
		description: 'Authentication domain',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	domain: string | null;

	@ApiPropertyOptional({
		description: 'Whether authentication is enabled',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@IsOptional()
	enabled: boolean = false;
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgDeviceInfo' })
export class ShellyNgDeviceInfoModel {
	@ApiProperty({
		description: 'Device identifier',
		example: 'shellyplus1-a8032abe5084',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiPropertyOptional({
		description: 'Device name',
		nullable: true,
		example: 'My Shelly Device',
	})
	@Expose()
	@IsOptional()
	@IsString()
	name: string | null = null;

	@ApiProperty({
		description: 'Device MAC address',
		example: 'A8032ABE5084',
	})
	@Expose()
	@IsString()
	mac: string;

	@ApiProperty({
		description: 'Device model',
		example: 'SNSW-001P16EU',
	})
	@Expose()
	@IsString()
	model: string;

	@ApiProperty({
		description: 'Firmware version',
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	firmware: string;

	@ApiProperty({
		description: 'Application name',
		example: 'Plus1',
	})
	@Expose()
	@IsString()
	app: string;

	@ApiPropertyOptional({
		description: 'Device profile',
		example: 'switch',
	})
	@Expose()
	@IsString()
	@IsOptional()
	profile?: string;

	@ApiProperty({
		description: 'Authentication configuration',
		type: () => ShellyNgDeviceInfoAuthenticationModel,
	})
	@Expose()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoAuthenticationModel)
	authentication: ShellyNgDeviceInfoAuthenticationModel;

	@ApiPropertyOptional({
		description: 'Whether device is discoverable',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	discoverable: boolean = true;

	@ApiProperty({
		description: 'Device components',
		type: () => ShellyNgDeviceInfoComponentModel,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoComponentModel)
	components: ShellyNgDeviceInfoComponentModel[];
}
