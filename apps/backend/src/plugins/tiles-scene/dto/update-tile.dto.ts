import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateSingleTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { ValidateSceneExists } from '../../../modules/scenes/validators/scene-exists-constraint.validator';
import { TILES_SCENE_TYPE } from '../tiles-scene.constants';

@ApiSchema({ name: 'TilesScenePluginUpdateSceneTile' })
export class UpdateSceneTileDto extends UpdateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_SCENE_TYPE,
		example: TILES_SCENE_TYPE,
	})
	readonly type: typeof TILES_SCENE_TYPE;

	@ApiPropertyOptional({
		description: 'Scene identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"scene","reason":"Scene must be a valid UUID (version 4)."}]' })
	@ValidateSceneExists({ message: '[{"field":"scene","reason":"The specified scene does not exist."}]' })
	scene?: string;

	@ApiPropertyOptional({
		description: 'Tile icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-play',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}

@ApiSchema({ name: 'TilesScenePluginReqUpdateSceneTile' })
export class ReqUpdateSceneTileDto {
	@ApiProperty({
		description: 'Scene tile update data',
		type: () => UpdateSceneTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneTileDto)
	data: UpdateSceneTileDto;
}
