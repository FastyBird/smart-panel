import { ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginCreateTimeTile' })
export class CreateTimeTileDto extends CreateSingleTileDto {
	readonly type: typeof TILES_TIME_TYPE;
}
