import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import type { components } from '../../../openapi';

type CreateHomeAssistantChannelProperty =
	components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty'];

export class CreateHomeAssistantChannelPropertyDto
	extends CreateChannelPropertyDto
	implements CreateHomeAssistantChannelProperty
{
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: 'home-assistant';

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@IsString({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	ha_attribute: string | null = null;
}
