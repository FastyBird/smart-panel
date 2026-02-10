import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceCategory, SpaceType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataSpace' })
@Entity('spaces_module_spaces')
export class SpaceEntity extends BaseEntity {
	@ApiProperty({
		description: 'Space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false })
	name: string;

	@ApiPropertyOptional({
		description: 'Space description',
		type: 'string',
		nullable: true,
		example: 'Main living area on the ground floor',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	description: string | null;

	@ApiProperty({
		description: 'Space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	@IsEnum(SpaceType)
	@Column({
		type: 'varchar',
		default: SpaceType.ROOM,
	})
	type: SpaceType;

	@ApiPropertyOptional({
		description: 'Space category (room type template)',
		enum: SpaceCategory,
		nullable: true,
		example: SpaceCategory.LIVING_ROOM,
	})
	@Expose()
	@IsOptional()
	@IsEnum(SpaceCategory)
	@Column({
		type: 'varchar',
		nullable: true,
		default: null,
	})
	category: SpaceCategory | null;

	@ApiPropertyOptional({
		name: 'parent_id',
		description: 'Parent zone ID (only for rooms). Rooms can optionally belong to a zone.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'parent_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { parent_id?: string | null; parentId?: string | null } }) => obj.parent_id ?? obj.parentId,
		{
			toClassOnly: true,
		},
	)
	@Index()
	@Column({ nullable: true, default: null })
	parentId: string | null;

	@ManyToOne(() => SpaceEntity, (space) => space.children, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'parentId' })
	parent: SpaceEntity | null;

	@ApiPropertyOptional({
		description: 'Child spaces (rooms that belong to this zone)',
		type: 'array',
		items: { $ref: '#/components/schemas/SpacesModuleDataSpace' },
		readOnly: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => SpaceEntity)
	@OneToMany(() => SpaceEntity, (space) => space.parent)
	children: SpaceEntity[];

	@ApiPropertyOptional({
		description: 'Icon identifier for the space',
		type: 'string',
		nullable: true,
		example: 'mdi:sofa',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon: string | null;

	@ApiProperty({
		name: 'display_order',
		description: 'Display order for sorting spaces',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsInt()
	@Min(0)
	@Transform(
		({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 0 })
	displayOrder: number;

	@ApiProperty({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'suggestions_enabled' })
	@Transform(
		({ obj }: { obj: { suggestions_enabled?: boolean; suggestionsEnabled?: boolean } }) =>
			obj.suggestions_enabled ?? obj.suggestionsEnabled,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: true })
	suggestionsEnabled: boolean;

	@ApiPropertyOptional({
		name: 'header_widgets',
		description: 'Ordered list of header widgets configured for this space',
		type: 'array',
		nullable: true,
		items: {
			type: 'object',
			properties: {
				type: { type: 'string', example: 'energy' },
				order: { type: 'number', example: 0 },
				settings: {
					type: 'object',
					properties: {
						range: { type: 'string', enum: ['today', 'week', 'month'], example: 'today' },
						show_production: { type: 'boolean', example: true },
					},
				},
			},
			required: ['type', 'order', 'settings'],
		},
		example: [{ type: 'energy', order: 0, settings: { range: 'today', show_production: true } }],
	})
	@Expose({ name: 'header_widgets' })
	@IsOptional()
	@IsArray()
	@Transform(
		({ obj }: { obj: { header_widgets?: unknown[] | null; headerWidgets?: unknown[] | null } }) =>
			obj.header_widgets ?? obj.headerWidgets ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'simple-json', nullable: true, default: null })
	headerWidgets: Record<string, unknown>[] | null;

	@ApiPropertyOptional({
		name: 'last_activity_at',
		description: 'The timestamp of the last device activity in this space',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'last_activity_at' })
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_activity_at?: string | Date; lastActivityAt?: string | Date } }) => {
			const value: string | Date | undefined = obj.last_activity_at ?? obj.lastActivityAt;
			if (!value) return null;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true, default: null })
	lastActivityAt: Date | string | null;
}
