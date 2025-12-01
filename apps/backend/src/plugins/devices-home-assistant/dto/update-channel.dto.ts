import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginUpdateChannel' })
export class UpdateHomeAssistantChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
