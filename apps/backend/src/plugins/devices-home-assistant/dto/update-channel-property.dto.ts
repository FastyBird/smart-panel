import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import type { components } from '../../../openapi';

type UpdateHomeAssistantChannelProperty =
	components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty'];

export class UpdateHomeAssistantChannelPropertyDto
	extends UpdateChannelPropertyDto
	implements UpdateHomeAssistantChannelProperty
{
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: 'home-assistant';
}
