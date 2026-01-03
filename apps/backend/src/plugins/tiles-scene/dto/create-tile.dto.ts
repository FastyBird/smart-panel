import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateSceneExists } from '../../../modules/scenes/validators/scene-exists-constraint.validator';
import { TILES_SCENE_TYPE } from '../tiles-scene.constants';

@ApiSchema({ name: 'TilesScenePluginCreateSceneTile' })
export class CreateSceneTileDto extends CreateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_SCENE_TYPE,
		example: TILES_SCENE_TYPE,
	})
	readonly type: typeof TILES_SCENE_TYPE;

	@ApiProperty({
		description: 'Scene identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"scene","reason":"Scene must be a valid UUID (version 4)."}]' })
	@ValidateSceneExists({ message: '[{"field":"scene","reason":"The specified scene does not exist."}]' })
	scene: string;

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

@ApiSchema({ name: 'TilesScenePluginReqCreateSceneTile' })
export class ReqCreateSceneTileDto {
	@ApiProperty({
		description: 'Scene tile creation data',
		type: CreateSceneTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateSceneTileDto)
	data: CreateSceneTileDto;
}
