import { Expose } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesShellyV1PluginDataSupportedDevice' })
export class ShellyV1SupportedDeviceModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device group',
		example: 'relay',
	})
	group: string;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device name',
		example: 'Shelly 1',
	})
	name: string;

	@Expose()
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Supported device models',
		type: 'array',
		items: { type: 'string' },
		example: ['SHSW-1', 'SHSW-L'],
	})
	models: string[];

	@Expose()
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Device categories',
		type: 'array',
		items: { type: 'string' },
		example: ['switch', 'light'],
	})
	categories: string[];
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataDeviceInfo' })
export class ShellyV1DeviceInfoModel {
	@Expose()
	@IsBoolean()
	@ApiProperty({
		description: 'Whether the device is reachable',
		example: true,
	})
	reachable: boolean;

	@Expose({ name: 'auth_required' })
	@IsBoolean()
	@ApiProperty({
		name: 'auth_required',
		description: 'Whether authentication is required',
		example: false,
	})
	authRequired: boolean;

	@Expose({ name: 'auth_valid' })
	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({
		name: 'auth_valid',
		description: 'Whether authentication is valid',
		example: true,
	})
	authValid?: boolean;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device host address',
		example: '192.168.1.100',
	})
	host: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device IP address',
		example: '192.168.1.100',
	})
	ip?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device MAC address',
		example: 'AA:BB:CC:DD:EE:FF',
	})
	mac?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device model',
		example: 'SHSW-1',
	})
	model?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device firmware version',
		example: '1.11.0',
	})
	firmware?: string;

	@Expose({ name: 'device_type' })
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		name: 'device_type',
		description: 'Device type',
		example: 'SHSW-1',
	})
	deviceType?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device description',
		example: 'Living room light switch',
	})
	description?: string;
}
