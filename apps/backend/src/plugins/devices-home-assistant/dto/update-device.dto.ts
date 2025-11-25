import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginUpdateHomeAssistantDevice' })
export class UpdateHomeAssistantDeviceDto extends UpdateDeviceDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	@ApiProperty({
		description: 'Device type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
