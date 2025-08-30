import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import type { components } from '../../../openapi';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

type UpdateTimeTile = components['schemas']['TilesTimePluginUpdateTimeTile'];

export class UpdateTimeTileDto extends UpdateTileDto implements UpdateTimeTile {
	readonly type: typeof TILES_TIME_TYPE;
}
