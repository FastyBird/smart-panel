import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInstance,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { Column, Entity, Index, ManyToOne, OneToMany, TableInheritance } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SceneCategory } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleDataScene' })
@Entity('scenes_module_scenes')
export class SceneEntity extends BaseEntity {
	@ApiPropertyOptional({
		name: 'primary_space_id',
		description: 'Primary space identifier this scene belongs to',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'primary_space_id' })
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"primary_space_id","reason":"Primary space ID must be a valid UUID (version 4)."}]',
	})
	@Transform(
		({ obj }: { obj: { primary_space_id?: string; primarySpaceId?: string } }) =>
			obj.primary_space_id ?? obj.primarySpaceId ?? null,
		{
			toClassOnly: true,
		},
	)
	@Index()
	@Column({ type: 'varchar', length: 36, nullable: true })
	primarySpaceId: string | null;

	@ApiProperty({ description: 'Scene category', enum: SceneCategory, example: SceneCategory.GENERIC })
	@Expose()
	@IsEnum(SceneCategory)
	@Column({
		type: 'text',
		enum: SceneCategory,
		default: SceneCategory.GENERIC,
	})
	category: SceneCategory;

	@ApiProperty({ description: 'Scene name', type: 'string', example: 'Movie Night' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiPropertyOptional({
		description: 'Scene description',
		type: 'string',
		example: 'Dims lights and sets TV to movie mode',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description: string | null;

	@ApiProperty({
		description: 'Display order for UI',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Column({ type: 'int', default: 0 })
	order: number = 0;

	@ApiProperty({ description: 'Scene enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiProperty({
		description: 'Whether scene can be manually triggered',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	@Column({ nullable: false, default: true })
	triggerable: boolean = true;

	@ApiProperty({
		description: 'Whether scene can be edited',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	@Column({ nullable: false, default: true })
	editable: boolean = true;

	@ApiPropertyOptional({
		name: 'last_triggered_at',
		description: 'Timestamp of last scene trigger',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
	})
	@Expose({ name: 'last_triggered_at' })
	@IsOptional()
	@Transform(
		({ obj }: { obj: { last_triggered_at?: string | Date; lastTriggeredAt?: string | Date } }) => {
			const value = obj.last_triggered_at ?? obj.lastTriggeredAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true })
	lastTriggeredAt: Date | string | null;

	@ApiProperty({
		description: 'Scene actions',
		type: 'array',
		items: { $ref: '#/components/schemas/ScenesModuleDataSceneAction' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SceneActionEntity)
	@OneToMany(() => SceneActionEntity, (action) => action.scene, { cascade: true, onDelete: 'CASCADE' })
	actions: SceneActionEntity[];
}

@ApiSchema({ name: 'ScenesModuleDataSceneAction' })
@Entity('scenes_module_scene_actions')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class SceneActionEntity extends BaseEntity {
	@ApiProperty({
		description: 'Scene identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"scene","reason":"Scene must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof SceneEntity)
	@IsInstance(SceneEntity, { message: '[{"field":"scene","reason":"Scene must be a valid SceneEntity."}]' })
	@Transform(({ value }: { value: SceneEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => SceneEntity, (scene) => scene.actions, { onDelete: 'CASCADE' })
	scene: SceneEntity | string;

	@ApiProperty({
		description: 'Action configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { device_id: 'uuid', property_id: 'uuid', value: true },
	})
	@Expose()
	@Column({ type: 'json', nullable: false, default: '{}' })
	configuration: Record<string, unknown> = {};

	@ApiProperty({ description: 'Action execution order', type: 'integer', example: 0 })
	@Expose()
	@IsInt()
	@Min(0)
	@Index()
	@Column({ type: 'int', default: 0 })
	order: number = 0;

	@ApiProperty({ description: 'Action enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiProperty({ description: 'Action type (plugin identifier)', type: 'string', example: 'local' })
	@Expose()
	@IsString()
	@Index()
	@Column({ type: 'varchar', length: 100, default: 'local' })
	type: string = 'local';
}
