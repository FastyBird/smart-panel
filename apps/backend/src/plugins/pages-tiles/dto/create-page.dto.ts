import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateTileType } from '../../../modules/dashboard/validators/tile-type-constraint.validator';
import type { components } from '../../../openapi';

type CreateTilesPage = components['schemas']['PagesTilesPluginCreateTilesPage'];

export class CreateTilesPageDto extends CreatePageDto implements CreateTilesPage {
	readonly type: 'tiles';

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileType()
	@Type(() => CreateTileDto)
	tiles?: CreateTileDto[];
}
