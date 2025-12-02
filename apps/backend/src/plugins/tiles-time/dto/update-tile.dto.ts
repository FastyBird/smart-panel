import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateSingleTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginUpdateTimeTile' })
export class UpdateTimeTileDto extends UpdateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_TIME_TYPE,
		example: TILES_TIME_TYPE,
	})
	readonly type: typeof TILES_TIME_TYPE;
}

@ApiSchema({ name: 'TilesTimePluginReqUpdateTimeTile' })
export class ReqUpdateTimeTileDto {
	@ApiProperty({
		description: 'Time tile update data',
		type: () => UpdateTimeTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateTimeTileDto)
	data: UpdateTimeTileDto;
}
