import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginUpdateConfig' })
export class HomeAssistantUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	})
	type: typeof DEVICES_HOME_ASSISTANT_PLUGIN_NAME;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	@ApiPropertyOptional({
		description: 'Home Assistant API access token',
		example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
		nullable: true,
		name: 'api_key',
	})
	api_key?: string | null = null;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"hostname","reason":"Hostname must be a valid string."}]' })
	@ApiPropertyOptional({
		description: 'Home Assistant hostname or IP address',
		example: 'homeassistant.local',
	})
	hostname?: string;
}
