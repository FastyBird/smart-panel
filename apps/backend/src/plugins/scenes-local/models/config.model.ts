import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { SCENES_LOCAL_PLUGIN_NAME } from '../scenes-local.constants';

@ApiSchema({ name: 'ScenesLocalPluginDataConfig' })
export class ScenesLocalConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SCENES_LOCAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = SCENES_LOCAL_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
