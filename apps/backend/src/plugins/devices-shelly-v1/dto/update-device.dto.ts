import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class UpdateShellyV1DeviceDto extends UpdateDeviceDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;

	@Expose()
	@IsOptional()
	@IsString()
	password?: string;

	@Expose()
	@IsOptional()
	@IsString()
	hostname?: string;
}
