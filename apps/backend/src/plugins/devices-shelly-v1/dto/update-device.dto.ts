import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';

export class UpdateShellyV1DeviceDto extends UpdateDeviceDto {
	@Expose()
	@IsOptional()
	@IsString()
	password?: string;

	@Expose()
	@IsOptional()
	@IsString()
	hostname?: string;
}
