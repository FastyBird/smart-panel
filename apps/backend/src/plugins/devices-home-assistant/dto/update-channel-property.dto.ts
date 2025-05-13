import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	ha_entity_id: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@IsString({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	ha_attribute: string;
}
