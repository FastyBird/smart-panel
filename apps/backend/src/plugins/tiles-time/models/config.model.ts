import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TILES_TIME_PLUGIN_NAME } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginDataConfig' })
export class TimeConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: TILES_TIME_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = TILES_TIME_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
