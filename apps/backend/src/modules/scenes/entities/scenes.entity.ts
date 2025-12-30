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
import { ConditionOperator, SceneCategory, TriggerType } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleDataScene' })
@Entity('scenes_module_scenes')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class SceneEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'Room space identifier this scene belongs to',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'space_id' })
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36 })
	spaceId: string;

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

	@ApiPropertyOptional({
		description: 'Scene icon identifier for UI',
		type: 'string',
		example: 'mdi:movie',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	icon: string | null;

	@ApiProperty({
		name: 'display_order',
		description: 'Display order for UI',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsInt()
	@Min(0)
	@Transform(({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder ?? 0, {
		toClassOnly: true,
	})
	@Column({ type: 'int', default: 0 })
	displayOrder: number = 0;

	@ApiProperty({ description: 'Scene enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiProperty({
		name: 'is_triggerable',
		description: 'Whether scene can be manually triggered',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_triggerable' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { is_triggerable?: boolean; isTriggerable?: boolean } }) =>
			obj.is_triggerable ?? obj.isTriggerable ?? true,
		{ toClassOnly: true },
	)
	@Column({ nullable: false, default: true })
	isTriggerable: boolean = true;

	@ApiProperty({
		name: 'is_editable',
		description: 'Whether scene can be edited (plugin-dependent)',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_editable' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { is_editable?: boolean; isEditable?: boolean } }) => obj.is_editable ?? obj.isEditable ?? true,
		{ toClassOnly: true },
	)
	@Column({ nullable: false, default: true })
	isEditable: boolean = true;

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

	@ApiProperty({
		description: 'Scene conditions (for future automation)',
		type: 'array',
		items: { $ref: '#/components/schemas/ScenesModuleDataSceneCondition' },
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SceneConditionEntity)
	@OneToMany(() => SceneConditionEntity, (condition) => condition.scene, { cascade: true, onDelete: 'CASCADE' })
	conditions: SceneConditionEntity[];

	@ApiProperty({
		description: 'Scene triggers (for future automation)',
		type: 'array',
		items: { $ref: '#/components/schemas/ScenesModuleDataSceneTrigger' },
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SceneTriggerEntity)
	@OneToMany(() => SceneTriggerEntity, (trigger) => trigger.scene, { cascade: true, onDelete: 'CASCADE' })
	triggers: SceneTriggerEntity[];

	@ApiProperty({ description: 'Scene type (plugin identifier)', type: 'string', example: 'scenes-local' })
	@Expose()
	@Index()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
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
		name: 'device_id',
		description: 'Target device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36 })
	deviceId: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'Target channel identifier (optional if device has single channel)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440002',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@ValidateIf((o) => o.channelId !== null && o.channelId !== undefined)
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string | null; channelId?: string | null } }) => obj.channel_id ?? obj.channelId ?? null, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36, nullable: true })
	channelId: string | null;

	@ApiProperty({
		name: 'property_id',
		description: 'Target property identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440003',
	})
	@Expose({ name: 'property_id' })
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { property_id?: string; propertyId?: string } }) => obj.property_id ?? obj.propertyId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36 })
	propertyId: string;

	@ApiProperty({
		description: 'Target value to set',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@Column({ type: 'json' })
	value: string | number | boolean;

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

	@ApiProperty({ description: 'Action type (plugin identifier)', type: 'string', example: 'scenes-local' })
	@Expose()
	@Index()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ApiSchema({ name: 'ScenesModuleDataSceneCondition' })
@Entity('scenes_module_scene_conditions')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class SceneConditionEntity extends BaseEntity {
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
	@ManyToOne(() => SceneEntity, (scene) => scene.conditions, { onDelete: 'CASCADE' })
	scene: SceneEntity | string;

	@ApiProperty({
		description: 'Logical operator with other conditions',
		enum: ConditionOperator,
		example: ConditionOperator.AND,
	})
	@Expose()
	@IsEnum(ConditionOperator)
	@Column({
		type: 'text',
		enum: ConditionOperator,
		default: ConditionOperator.AND,
	})
	operator: ConditionOperator = ConditionOperator.AND;

	@ApiProperty({
		description: 'Condition configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { deviceId: 'uuid', propertyId: 'uuid', operator: 'eq', value: true },
	})
	@Expose()
	@Column({ type: 'json', default: {} })
	configuration: Record<string, unknown> = {};

	@ApiProperty({ description: 'Condition enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiProperty({ description: 'Condition type (plugin identifier)', type: 'string', example: 'device-state' })
	@Expose()
	@Index()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ApiSchema({ name: 'ScenesModuleDataSceneTrigger' })
@Entity('scenes_module_scene_triggers')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class SceneTriggerEntity extends BaseEntity {
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
	@ManyToOne(() => SceneEntity, (scene) => scene.triggers, { onDelete: 'CASCADE' })
	scene: SceneEntity | string;

	@ApiProperty({
		name: 'trigger_type',
		description: 'Type of trigger',
		enum: TriggerType,
		example: TriggerType.MANUAL,
	})
	@Expose({ name: 'trigger_type' })
	@IsEnum(TriggerType)
	@Transform(
		({ obj }: { obj: { trigger_type?: TriggerType; triggerType?: TriggerType } }) =>
			obj.trigger_type ?? obj.triggerType,
		{ toClassOnly: true },
	)
	@Index()
	@Column({
		type: 'text',
		enum: TriggerType,
		default: TriggerType.MANUAL,
	})
	triggerType: TriggerType = TriggerType.MANUAL;

	@ApiProperty({
		description: 'Trigger configuration (type-specific)',
		type: 'object',
		additionalProperties: true,
		example: { cron: '0 8 * * *' },
	})
	@Expose()
	@Column({ type: 'json', default: {} })
	configuration: Record<string, unknown> = {};

	@ApiProperty({ description: 'Trigger enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiProperty({ description: 'Trigger type (plugin identifier)', type: 'string', example: 'schedule' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}
