import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ChildEntity()
export class TimeTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return TILES_TIME_TYPE;
	}
}
