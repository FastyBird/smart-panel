import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class CreateShellyV1DeviceDto extends CreateDeviceDto {
	@Expose()
	@IsOptional()
	@IsString()
	password?: string;

	@Expose()
	@IsOptional()
	@IsString()
	hostname?: string;

	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}
}
