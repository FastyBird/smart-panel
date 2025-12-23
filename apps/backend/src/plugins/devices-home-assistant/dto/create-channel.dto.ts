import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

import { CreateHomeAssistantChannelPropertyDto } from './create-channel-property.dto';

@ApiSchema({ name: 'DevicesHomeAssistantPluginCreateChannel' })
export class CreateHomeAssistantChannelDto extends CreateChannelDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	/**
	 * Override properties to use HomeAssistant-specific DTO that includes ha_entity_id and ha_attribute
	 */
	@ApiPropertyOptional({
		description: 'Channel properties',
		type: 'array',
		items: { $ref: getSchemaPath(CreateHomeAssistantChannelPropertyDto) },
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"properties","reason":"Properties must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateHomeAssistantChannelPropertyDto)
	override properties?: CreateHomeAssistantChannelPropertyDto[];
}
