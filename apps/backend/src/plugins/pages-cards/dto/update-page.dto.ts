import { ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import type { components } from '../../../openapi';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

type UpdateCardsPage = components['schemas']['PagesCardsPluginUpdateCardsPage'];

@ApiSchema({ name: 'PagesCardsPluginUpdateCardsPage' })
export class UpdateCardsPageDto extends UpdatePageDto implements UpdateCardsPage {
	readonly type: typeof PAGES_CARDS_TYPE;
}
