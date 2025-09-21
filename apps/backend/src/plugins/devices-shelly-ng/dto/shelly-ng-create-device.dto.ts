import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

class ShellyNgCreateDeviceDto extends CreateDeviceDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"key","reason":"Key must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"key","reason":"Key must be a non-empty string."}]' })
	group: string;

	@Expose()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	hostname: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}

export default ShellyNgCreateDeviceDto;
