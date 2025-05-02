import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import type { components } from '../../../openapi';

type CreateHomeAssistantChannel = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannel'];

export class CreateHomeAssistantChannelDto extends CreateChannelDto implements CreateHomeAssistantChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: 'home-assistant';

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	readonly ha_entity_id: string;
}
