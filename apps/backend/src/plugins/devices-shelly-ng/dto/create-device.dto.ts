import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginCreateDevice' })
export class CreateShellyNgDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_SHELLY_NG_TYPE;

	@ApiPropertyOptional({
		description: 'Device password',
		example: 'password123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;

	@ApiPropertyOptional({
		description: 'WiFi IP address or hostname of the device',
		example: '192.168.1.100',
		nullable: true,
		name: 'wifi_address',
	})
	@Expose({ name: 'wifi_address' })
	@IsOptional()
	@IsString({ message: '[{"field":"wifi_address","reason":"WiFi address must be a valid string."}]' })
	wifiAddress?: string | null = null;
}
