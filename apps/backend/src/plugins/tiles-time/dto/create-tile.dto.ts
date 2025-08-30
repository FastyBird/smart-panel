import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

type CreateTimeTile = components['schemas']['TilesTimePluginCreateTimeTile'];

export class CreateTimeTileDto extends CreateSingleTileDto implements CreateTimeTile {
	readonly type: typeof TILES_TIME_TYPE;
}
