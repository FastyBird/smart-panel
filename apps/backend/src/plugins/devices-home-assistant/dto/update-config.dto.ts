import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

export class HomeAssistantUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	api_key?: string | null = null;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"hostname","reason":"Hostname must be a valid string."}]' })
	hostname?: string;
}
