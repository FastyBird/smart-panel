import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type CreateHomeAssistantDevice = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantDevice'];

export class CreateHomeAssistantDeviceDto extends CreateDeviceDto implements CreateHomeAssistantDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	@IsString({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	ha_device_id: string;
}
