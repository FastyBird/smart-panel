import { Expose } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

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
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@ValidateIf((_, value) => value !== null)
	password?: string | null;

	@ApiPropertyOptional({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@ValidateIf((_, value) => value !== null)
	hostname?: string | null;
}
