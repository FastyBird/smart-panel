import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME } from '../spaces-synthetic-entry.constants';

@ApiSchema({ name: 'SpacesSyntheticEntryPluginDataConfig' })
export class SpacesSyntheticEntryConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
