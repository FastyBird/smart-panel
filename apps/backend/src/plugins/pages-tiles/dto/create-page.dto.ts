import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, Min, ValidateNested } from 'class-validator';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateTileType } from '../../../modules/dashboard/validators/tile-type-constraint.validator';
import type { components } from '../../../openapi';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

type CreateTilesPage = components['schemas']['PagesTilesPluginCreateTilesPage'];

export class CreateTilesPageDto extends CreatePageDto implements CreateTilesPage {
	readonly type: typeof PAGES_TILES_TYPE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"tile_size","reason":"Tile size must be a valid number."}]' })
	@IsInt({ message: '[{"field":"tile_size","reason":"Tile size must be a whole number."}]' })
	@Min(1, { message: '[{"field":"tile_size","reason":"Tile size minimum value must be greater than 0."}]' })
	tile_size?: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"rows","reason":"Row count must be a valid number."}]' })
	@IsInt({ message: '[{"field":"rows","reason":"Row count must be a whole number."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Row count minimum value must be greater than 0."}]' })
	rows?: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@IsInt({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Column count minimum value must be greater than 0."}]' })
	cols?: number;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileType()
	@Type(() => CreateTileDto)
	tiles?: CreateTileDto[];
}
