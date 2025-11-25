import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { PAGES_TILES_PLUGIN_NAME } from '../pages-tiles.constants';

@ApiSchema({ name: 'PagesTilesPluginConfig' })
export class TilesConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: PAGES_TILES_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = PAGES_TILES_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
