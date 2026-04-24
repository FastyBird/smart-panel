import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME } from '../spaces-signage-info-panel.constants';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginDataConfig' })
export class SpacesSignageInfoPanelConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
