import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type CreateHomeAssistantChannelProperty =
	components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty'];

@ApiSchema('DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty')
export class CreateHomeAssistantChannelPropertyDto
	extends CreateChannelPropertyDto
	implements CreateHomeAssistantChannelProperty
{
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	@ApiProperty({
		description: 'Channel property type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	@ApiPropertyOptional({
		description: 'Home Assistant entity ID',
		example: 'light.living_room',
		nullable: true,
		name: 'ha_entity_id',
	})
	ha_entity_id: string | null;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@IsString({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@ValidateIf((_, value) => value !== null)
	@ApiPropertyOptional({
		description: 'Home Assistant entity attribute name',
		example: 'brightness',
		nullable: true,
		name: 'ha_attribute',
	})
	ha_attribute: string | null;
}
