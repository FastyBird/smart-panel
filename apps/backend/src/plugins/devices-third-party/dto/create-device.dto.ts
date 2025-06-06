import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import type { components } from '../../../openapi';

type CreateThirdPartyDevice = components['schemas']['DevicesThirdPartyPluginCreateThirdPartyDevice'];

export class CreateThirdPartyDeviceDto extends CreateDeviceDto implements CreateThirdPartyDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: 'third-party';

	@Expose()
	@IsNotEmpty({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	@IsString({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	service_address: string;
}
