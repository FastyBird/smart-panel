import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginUpdateDevice' })
export class UpdateHomeAssistantDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
