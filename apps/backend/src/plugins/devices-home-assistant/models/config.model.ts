import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

export class HomeAssistantConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = DEVICES_HOME_ASSISTANT_TYPE;

	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@Expose()
	@IsString()
	hostname: string = 'homeassistant.local';
}
