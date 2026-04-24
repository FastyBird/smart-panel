import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME } from '../spaces-signage-info-panel.constants';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginUpdateConfig' })
export class SpacesSignageInfoPanelUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME;
}
