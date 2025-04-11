import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import type { components } from '../../../openapi';

type UpdateTimeTile = components['schemas']['DashboardUpdateTimeTile'];

export class UpdateTimeTileDto extends UpdateTileDto implements UpdateTimeTile {
	readonly type: 'clock';
}
