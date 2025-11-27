import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesShellyV1PluginShellyV1Probe' })
export class ShellyV1ProbeDto {
	@ApiProperty({
		description: 'Shelly device host (IP address or hostname)',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString({
		message: '[{"field":"host","reason":"Host attribute must be a valid IP address or hostname."}]',
	})
	host: string;

	@ApiPropertyOptional({
		description: 'Shelly device authentication password',
		example: 'admin123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}

/**
 * Request wrapper for DevicesShellyV1PluginCreateDeviceInfo
 */
@ApiSchema({ name: 'DevicesShellyV1PluginReqCreateDeviceInfo' })
export class DevicesShellyV1PluginReqCreateDeviceInfo {
	@ApiProperty({ description: 'Device probe request data', type: () => DevicesShellyV1PluginCreateDeviceInfo })
	@Expose()
	@ValidateNested()
	@Type(() => DevicesShellyV1PluginCreateDeviceInfo)
	data: DevicesShellyV1PluginCreateDeviceInfo;
}
