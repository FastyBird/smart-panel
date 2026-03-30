import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginUpdateDevice' })
export class UpdateShellyNgDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
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
		description: 'WiFi interface IP address',
		name: 'wifi_address',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose({ name: 'wifi_address' })
	@IsOptional()
	@IsString({
		message: '[{"field":"wifi_address","reason":"WiFi address must be a valid IP address or network hostname."}]',
	})
	wifiAddress?: string | null;

	@ApiPropertyOptional({
		description: 'Ethernet interface IP address',
		name: 'ethernet_address',
		example: '192.168.1.101',
		nullable: true,
	})
	@Expose({ name: 'ethernet_address' })
	@IsOptional()
	@IsString({
		message:
			'[{"field":"ethernet_address","reason":"Ethernet address must be a valid IP address or network hostname."}]',
	})
	ethernetAddress?: string | null;
}
