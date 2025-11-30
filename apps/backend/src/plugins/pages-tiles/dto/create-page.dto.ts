import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, Min, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateTileType } from '../../../modules/dashboard/validators/tile-type-constraint.validator';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

@ApiSchema({ name: 'PagesTilesPluginCreateTilesPage' })
export class CreateTilesPageDto extends CreatePageDto {
	readonly type: typeof PAGES_TILES_TYPE;

	@ApiPropertyOptional({
		description: 'Tile size in pixels',
		name: 'tile_size',
		type: 'integer',
		minimum: 1,
		example: 100,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"tile_size","reason":"Tile size must be a valid number."}]' })
	@IsInt({ message: '[{"field":"tile_size","reason":"Tile size must be a whole number."}]' })
	@Min(1, { message: '[{"field":"tile_size","reason":"Tile size minimum value must be greater than 0."}]' })
	tile_size?: number | null;

	@ApiPropertyOptional({
		description: 'Number of rows',
		type: 'integer',
		minimum: 1,
		example: 4,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"rows","reason":"Row count must be a valid number."}]' })
	@IsInt({ message: '[{"field":"rows","reason":"Row count must be a whole number."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Row count minimum value must be greater than 0."}]' })
	rows?: number | null;

	@ApiPropertyOptional({
		description: 'Number of columns',
		type: 'integer',
		minimum: 1,
		example: 6,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@IsInt({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Column count minimum value must be greater than 0."}]' })
	cols?: number | null;

	@ApiPropertyOptional({
		description: 'Page tiles',
		type: 'array',
		items: { $ref: getSchemaPath(CreateTileDto) },
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileType()
	@Type(() => CreateTileDto)
	tiles?: CreateTileDto[];
}
