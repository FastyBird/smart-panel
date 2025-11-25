import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

type UpdateThirdPartyDevice = components['schemas']['DevicesThirdPartyPluginUpdateThirdPartyDevice'];

@ApiSchema({ name: 'DevicesThirdPartyPluginUpdateDevice' })
export class UpdateThirdPartyDeviceDto extends UpdateDeviceDto implements UpdateThirdPartyDevice {
	@ApiProperty({
		description: 'Device type',
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_THIRD_PARTY_TYPE;

	@ApiPropertyOptional({
		description: 'Service address for third-party device',
		name: 'service_address',
		example: 'http://192.168.1.100:8080',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	@IsString({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	service_address?: string;
}
