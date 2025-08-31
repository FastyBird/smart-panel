import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { PAGES_CARDS_PLUGIN_NAME } from '../pages-cards.constants';

export class CardsConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = PAGES_CARDS_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
