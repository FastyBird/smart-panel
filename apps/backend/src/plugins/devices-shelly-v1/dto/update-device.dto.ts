import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginUpdateDevice' })
export class UpdateShellyV1DeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type identifier',
		example: 'devices-shelly-v1',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;

	@ApiPropertyOptional({
		description: 'Device authentication password',
		example: 'admin123',
	})
	@Expose()
	@IsOptional()
	@IsString()
	password?: string;

	@ApiPropertyOptional({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
	})
	@Expose()
	@IsOptional()
	@IsString()
	hostname?: string;
}

/**
 * Alias for DevicesShellyV1PluginUpdateShellyV1Device (OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'DevicesShellyV1PluginUpdateShellyV1Device' })
export class DevicesShellyV1PluginUpdateShellyV1Device extends UpdateShellyV1DeviceDto {}
