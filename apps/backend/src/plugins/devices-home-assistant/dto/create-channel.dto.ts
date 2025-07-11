import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type CreateHomeAssistantChannel = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannel'];

export class CreateHomeAssistantChannelDto extends CreateChannelDto implements CreateHomeAssistantChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
