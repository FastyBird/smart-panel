import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_THIRD_PARTY_PLUGIN_NAME } from '../devices-third-party.constants';

export class ThirdPartyConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = DEVICES_THIRD_PARTY_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
