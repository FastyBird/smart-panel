import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

export class ShellyNgConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = DEVICES_SHELLY_NG_PLUGIN_NAME;
}
