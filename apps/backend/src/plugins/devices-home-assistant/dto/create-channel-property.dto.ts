import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

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
	@IsNotEmpty({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	ha_entity_id: string | null;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@IsString({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@ValidateIf((_, value) => value !== null)
	ha_attribute: string | null;
}
