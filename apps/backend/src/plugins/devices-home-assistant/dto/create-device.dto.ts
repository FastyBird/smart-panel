import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginCreateHomeAssistantDevice' })
export class CreateHomeAssistantDeviceDto extends CreateDeviceDto {
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
