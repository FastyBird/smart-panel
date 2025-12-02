import { Expose } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';

@ApiSchema({ name: 'PagesTilesPluginUpdateTilesPage' })
export class UpdateTilesPageDto extends UpdatePageDto {
	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_TILES_TYPE,
		example: PAGES_TILES_TYPE,
	})
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
	@IsInt({ message: '[{"field":"cols","reason":"Column count must be a valid number."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Column count minimum value must be greater than 0."}]' })
	cols?: number | null;
}
