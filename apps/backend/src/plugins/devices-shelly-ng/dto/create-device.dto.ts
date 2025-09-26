import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type CreateShellyNgDevice = components['schemas']['DevicesShellyNgPluginCreateShellyNgDevice'];

export class CreateShellyNgDeviceDto extends CreateDeviceDto implements CreateShellyNgDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_SHELLY_NG_TYPE;

	@Expose()
	@IsOptional()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	hostname: string | null = null;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}
