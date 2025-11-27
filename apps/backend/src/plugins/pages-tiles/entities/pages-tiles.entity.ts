import { Expose } from 'class-transformer';
import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

@ApiSchema({ name: 'PagesTilesPluginDataTilesPage' })
@ChildEntity()
export class TilesPageEntity extends PageEntity {
	@ApiProperty({
		description: 'Page tiles',
		type: 'array',
		items: { $ref: '#/components/schemas/DashboardModuleDataTile' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[];

	@ApiPropertyOptional({
		description: 'Tile size in pixels',
		name: 'tile_size',
		type: 'number',
		nullable: true,
		example: 100,
	})
	@Expose({ name: 'tile_size' })
	@IsOptional()
	@IsInt()
	@Column({ type: 'float', nullable: true, default: null })
	tileSize: number | null;

	@ApiPropertyOptional({
		description: 'Number of rows',
		type: 'integer',
		nullable: true,
		example: 4,
	})
	@Expose()
	@IsOptional()
	@IsInt()
	@Column({ type: 'int', nullable: true, default: null })
	rows: number | null;

	@ApiPropertyOptional({
		description: 'Number of columns',
		type: 'integer',
		nullable: true,
		example: 6,
	})
	@Expose()
	@IsOptional()
	@IsInt()
	@Column({ type: 'int', nullable: true, default: null })
	cols: number | null;

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		example: PAGES_TILES_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_TILES_TYPE;
	}
}
