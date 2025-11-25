import { Expose } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

@ApiSchema({ name: 'PagesTilesPluginUpdateTilesPage' })
export class UpdateTilesPageDto extends UpdatePageDto {
	readonly type: typeof PAGES_TILES_TYPE;

	@ApiPropertyOptional({
		description: 'Tile size in pixels',
		name: 'tile_size',
		type: 'integer',
		minimum: 1,
		example: 100,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"tile_size","reason":"Tile size must be a valid number."}]' })
	@IsInt({ message: '[{"field":"tile_size","reason":"Tile size must be a whole number."}]' })
	@Min(1, { message: '[{"field":"tile_size","reason":"Tile size minimum value must be greater than 0."}]' })
	tile_size?: number;

	@ApiPropertyOptional({
		description: 'Number of rows',
		type: 'integer',
		minimum: 1,
		example: 4,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Row count must be a whole number."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Row count minimum value must be greater than 0."}]' })
	rows?: number;

	@ApiPropertyOptional({
		description: 'Number of columns',
		type: 'integer',
		minimum: 1,
		example: 6,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Column count minimum value must be greater than 0."}]' })
	cols?: number;
}
