import { Exclude, Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { TILES_SCENE_TYPE } from '../tiles-scene.constants';

@ApiSchema({ name: 'TilesScenePluginDataSceneTile' })
@ChildEntity()
export class SceneTileEntity extends TileEntity {
	@ApiProperty({
		description: 'Scene identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"scene","reason":"Scene must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [SceneEntity], {
		message: '[{"field":"scene","reason":"Scene must be a valid subclass of SceneEntity."}]',
	})
	@Transform(({ value }: { value: SceneEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => SceneEntity, { onDelete: 'CASCADE', eager: true })
	scene: SceneEntity | string;

	@ApiPropertyOptional({
		description: 'Tile icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-play',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@Exclude({ toPlainOnly: true })
	@RelationId((tile: SceneTileEntity) => tile.scene)
	sceneId: string;

	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_SCENE_TYPE,
		example: TILES_SCENE_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_SCENE_TYPE;
	}
}
