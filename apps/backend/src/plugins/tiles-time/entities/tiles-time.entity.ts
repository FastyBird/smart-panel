import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';

@ChildEntity()
export class TimeTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'clock';
	}
}
