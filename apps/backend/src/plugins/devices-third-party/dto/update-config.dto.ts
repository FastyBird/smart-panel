import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_THIRD_PARTY_PLUGIN_NAME } from '../devices-third-party.constants';

export class ThirdPartyUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_THIRD_PARTY_PLUGIN_NAME;
}
