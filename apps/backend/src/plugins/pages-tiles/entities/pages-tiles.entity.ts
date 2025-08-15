import { Expose } from 'class-transformer';
import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';

@ChildEntity()
export class TilesPageEntity extends PageEntity {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[];

	@Expose({ name: 'tile_size' })
	@IsOptional()
	@IsInt()
	@Column({ type: 'float', nullable: true, default: null })
	tileSize: number | null;

	@Expose()
	@IsOptional()
	@IsInt()
	@Column({ type: 'int', nullable: true, default: null })
	rows: number | null;

	@Expose()
	@IsOptional()
	@IsInt()
	@Column({ type: 'int', nullable: true, default: null })
	cols: number | null;

	@Expose()
	get type(): string {
		return 'tiles';
	}
}
