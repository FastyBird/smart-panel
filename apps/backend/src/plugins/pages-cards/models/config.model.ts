import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { PAGES_CARDS_PLUGIN_NAME } from '../pages-cards.constants';

@ApiSchema({ name: 'PagesCardsPluginDataConfig' })
export class CardsConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: PAGES_CARDS_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = PAGES_CARDS_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
