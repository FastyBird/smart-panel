import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME } from '../pages-device-detail.constants';

export class DeviceDetailConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = PAGES_DEVICE_DETAIL_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
