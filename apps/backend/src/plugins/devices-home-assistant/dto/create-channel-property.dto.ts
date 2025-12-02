import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginCreateChannelProperty' })
export class CreateHomeAssistantChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Home Assistant entity ID must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	@ApiProperty({
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
	@ApiProperty({
		description: 'Home Assistant entity attribute name',
		example: 'brightness',
		nullable: true,
		name: 'ha_attribute',
	})
	ha_attribute: string | null;
}
