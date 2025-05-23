import { Expose } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ChildEntity } from 'typeorm';

import { PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';

@ChildEntity()
export class TilesPageEntity extends PageEntity {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[];

	@Expose()
	get type(): string {
		return 'tiles';
	}
}
