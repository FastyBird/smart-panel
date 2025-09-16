import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TILES_TIME_PLUGIN_NAME } from '../tiles-time.constants';

export class TimeConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = TILES_TIME_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
