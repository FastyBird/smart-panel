import { Expose, Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, TableInheritance } from 'typeorm';

import { ApiProperty } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceRoleType } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

/**
 * Abstract root of the unified `spaces_module_space_roles` inheritance table.
 *
 * Each concrete subtype (`SpaceLightingRoleEntity`, `SpaceClimateRoleEntity`, ...) is a
 * `@ChildEntity` that declares its own columns; TypeORM writes them all to the single
 * unified table with a `type` discriminator.
 *
 * Common columns (id, timestamps, spaceId) live here. The `spaceId` FK with CASCADE
 * applies to every subtype.
 */
@Entity('spaces_module_space_roles')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class SpaceRoleEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space this role assignment belongs to',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ nullable: false })
	spaceId: string;

	@ManyToOne(() => SpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	@ApiProperty({ description: 'Role type discriminator', enum: SpaceRoleType, example: SpaceRoleType.LIGHTING })
	@Expose()
	get type(): SpaceRoleType {
		// Subtypes MUST override this getter and return the same discriminator value
		// they pass to @ChildEntity(...) and register with SpaceRolesTypeMapperService.
		// Throwing here catches plugin authors who forget, rather than silently
		// returning a lowercased class name (e.g. "spacelightingroleentity") that
		// would mismatch the discriminator and break mapper lookups.
		throw new Error(
			`SpaceRoleEntity subclass "${this.constructor.name}" must override the \`type\` getter to return its registered discriminator.`,
		);
	}
}
