import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type CreateHomeAssistantDevice = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantDevice'];

@ApiSchema('DevicesHomeAssistantPluginCreateHomeAssistantDevice')
export class CreateHomeAssistantDeviceDto extends CreateDeviceDto implements CreateHomeAssistantDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	@ApiProperty({
		description: 'Device type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	@IsString({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	@ApiProperty({
		description: 'Home Assistant device identifier',
		example: 'abc123def456',
		name: 'ha_device_id',
	})
	ha_device_id: string;
}
