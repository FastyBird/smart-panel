import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';

@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateDevice' })
export class UpdateProtectDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_UNIFI_PROTECT_TYPE,
		example: DEVICES_UNIFI_PROTECT_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_UNIFI_PROTECT_TYPE;
}
