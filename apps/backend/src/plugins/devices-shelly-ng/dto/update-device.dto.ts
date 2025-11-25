import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type UpdateShellyNgDevice = components['schemas']['DevicesShellyNgPluginUpdateShellyNgDevice'];

@ApiSchema({ name: 'DevicesShellyNgPluginUpdateShellyNgDevice' })
export class UpdateShellyNgDeviceDto extends UpdateDeviceDto implements UpdateShellyNgDevice {
	@ApiProperty({
		description: 'Device type',
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;

	@ApiPropertyOptional({
		description: 'Device password',
		example: 'password123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null;

	@ApiPropertyOptional({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	hostname?: string | null;
}
