import { ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

@ApiSchema({ name: 'PagesCardsPluginUpdateCardsPage' })
export class UpdateCardsPageDto extends UpdatePageDto {
	readonly type: typeof PAGES_CARDS_TYPE;
}
