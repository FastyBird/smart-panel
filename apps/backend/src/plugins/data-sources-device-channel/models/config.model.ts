import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DATA_SOURCES_DEVICE_PLUGIN_NAME } from '../data-sources-device-channel.constants';

export class DeviceChannelConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = DATA_SOURCES_DEVICE_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
