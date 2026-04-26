import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, TableInheritance } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataSpace' })
@Entity('spaces_module_spaces')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class SpaceEntity extends BaseEntity {
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

	@ApiProperty({ description: 'Space type', enum: SpaceType, example: SpaceType.ROOM })
	@Expose()
	get type(): SpaceType {
		// Subtypes MUST override this getter and return the same discriminator value
		// they pass to @ChildEntity(...) and register with SpacesTypeMapperService.
		// Throwing here catches plugin authors who forget, rather than silently
		// returning a lowercased class name (e.g. "roomspaceentity") that would
		// mismatch the discriminator and break mapper lookups.
		throw new Error(
			`SpaceEntity subclass "${this.constructor.name}" must override the \`type\` getter to return its registered discriminator.`,
		);
	}
}
