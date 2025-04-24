import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import type { components } from '../../../openapi';

type UpdateTilesPage = components['schemas']['PagesTilesPluginUpdateTilesPage'];

export class UpdateTilesPageDto extends UpdatePageDto implements UpdateTilesPage {
	readonly type: 'tiles';
}
