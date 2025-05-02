import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { PluginConfigEntity } from '../../../modules/config/entities/config.entity';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

export class HomeAssistantConfigEntity extends PluginConfigEntity {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = DEVICES_HOME_ASSISTANT_PLUGIN_NAME;

	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@IsString()
	hostname: string = 'homeassistant.local';
}
