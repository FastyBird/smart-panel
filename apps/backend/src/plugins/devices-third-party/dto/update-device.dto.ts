import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import type { components } from '../../../openapi';

type UpdateThirdPartyDevice = components['schemas']['DevicesThirdPartyPluginUpdateThirdPartyDevice'];

export class UpdateThirdPartyDeviceDto extends UpdateDeviceDto implements UpdateThirdPartyDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: 'third-party';

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	@IsString({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	service_address?: string;
}
