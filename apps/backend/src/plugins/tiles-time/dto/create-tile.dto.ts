import { ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import type { components } from '../../../openapi';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

type CreateTimeTile = components['schemas']['TilesTimePluginCreateTimeTile'];

@ApiSchema({ name: 'TilesTimePluginCreateTimeTile' })
export class CreateTimeTileDto extends CreateSingleTileDto implements CreateTimeTile {
	readonly type: typeof TILES_TIME_TYPE;
}
