import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { PAGES_TILES_PLUGIN_NAME } from '../pages-tiles.constants';

export class TilesConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = PAGES_TILES_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
