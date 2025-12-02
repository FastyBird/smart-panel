import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { PAGES_CARDS_PLUGIN_NAME } from '../pages-cards.constants';

@ApiSchema({ name: 'PagesCardsPluginUpdateConfig' })
export class CardsUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: PAGES_CARDS_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof PAGES_CARDS_PLUGIN_NAME;
}
