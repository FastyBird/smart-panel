import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type UpdateHomeAssistantDevice = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantDevice'];

@ApiSchema('DevicesHomeAssistantPluginUpdateHomeAssistantDevice')
export class UpdateHomeAssistantDeviceDto extends UpdateDeviceDto implements UpdateHomeAssistantDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	@ApiProperty({
		description: 'Device type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
