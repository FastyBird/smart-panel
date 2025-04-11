import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';

type CreateTimeTile = components['schemas']['DashboardCreateTimeTile'];

export class CreateTimeTileDto extends CreateTileDto implements CreateTimeTile {
	readonly type: 'clock';
}
