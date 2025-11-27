import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataConfig' })
export class HomeAssistantConfigModel extends PluginConfigModel {
	// Alias for OpenAPI spec compatibility
	static readonly ConfigAlias = HomeAssistantConfigModel;
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_HOME_ASSISTANT_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Home Assistant API key for authentication',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiProperty({
		description: 'Home Assistant hostname or IP address',
		type: 'string',
		example: 'homeassistant.local',
	})
	@Expose()
	@IsString()
	hostname: string = 'homeassistant.local';
}
