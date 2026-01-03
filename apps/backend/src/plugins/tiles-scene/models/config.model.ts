import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TILES_SCENE_PLUGIN_NAME } from '../tiles-scene.constants';

@ApiSchema({ name: 'TilesScenePluginDataConfig' })
export class SceneConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: TILES_SCENE_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = TILES_SCENE_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
