import { Expose } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import type { components } from '../../../openapi';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

type UpdateTilesPage = components['schemas']['PagesTilesPluginUpdateTilesPage'];

export class UpdateTilesPageDto extends UpdatePageDto implements UpdateTilesPage {
	readonly type: typeof PAGES_TILES_TYPE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"tile_size","reason":"Tile size must be a valid number."}]' })
	@IsInt({ message: '[{"field":"tile_size","reason":"Tile size must be a whole number."}]' })
	@Min(1, { message: '[{"field":"tile_size","reason":"Tile size minimum value must be greater than 0."}]' })
	tile_size?: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Row count must be a whole number."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Row count minimum value must be greater than 0."}]' })
	rows?: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Column count minimum value must be greater than 0."}]' })
	cols?: number;
}
