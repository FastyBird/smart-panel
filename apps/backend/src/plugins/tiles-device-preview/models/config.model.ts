import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME } from '../tiles-device-preview.constants';

export class DevicePreviewConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = TILES_DEVICE_PREVIEW_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
