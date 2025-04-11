import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import type { components } from '../../../openapi';

type UpdateCardsPage = components['schemas']['DashboardUpdateCardsPage'];

export class UpdateCardsPageDto extends UpdatePageDto implements UpdateCardsPage {
	readonly type: 'cards';
}
