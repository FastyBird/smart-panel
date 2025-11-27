import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginDataTimeTile' })
@ChildEntity()
export class TimeTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		example: TILES_TIME_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_TIME_TYPE;
	}
}
