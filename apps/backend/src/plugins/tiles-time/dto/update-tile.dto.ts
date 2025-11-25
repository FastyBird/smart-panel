import { ApiSchema } from '@nestjs/swagger';

import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginUpdateTimeTile' })
export class UpdateTimeTileDto extends UpdateTileDto {
	readonly type: typeof TILES_TIME_TYPE;
}
