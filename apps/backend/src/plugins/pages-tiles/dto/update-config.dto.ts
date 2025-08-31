import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { PAGES_TILES_PLUGIN_NAME } from '../pages-tiles.constants';

export class TilesUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof PAGES_TILES_PLUGIN_NAME;
}
