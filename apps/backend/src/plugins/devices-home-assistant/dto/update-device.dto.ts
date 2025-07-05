import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type UpdateHomeAssistantDevice = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantDevice'];

export class UpdateHomeAssistantDeviceDto extends UpdateDeviceDto implements UpdateHomeAssistantDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
