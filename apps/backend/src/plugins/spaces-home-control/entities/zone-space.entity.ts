import { Expose, Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	ALL_SPACE_CATEGORIES,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataZoneSpace' })
@ChildEntity(SpaceType.ZONE)
export class ZoneSpaceEntity extends SpaceEntity {
	@ApiProperty({ description: 'Space type', enum: SpaceType, default: SpaceType.ZONE, example: SpaceType.ZONE })
	@Expose()
	get type(): SpaceType {
		return SpaceType.ZONE;
	}

	@ApiPropertyOptional({
		description: 'Space category (zone type template)',
		enum: ALL_SPACE_CATEGORIES,
		nullable: true,
		example: SpaceZoneCategory.FLOOR_GROUND,
	})
	@Expose()
	@IsOptional()
	@IsEnum({ ...SpaceRoomCategory, ...SpaceZoneCategory })
	@Column({ type: 'varchar', nullable: true, default: null })
	category: SpaceRoomCategory | SpaceZoneCategory | null;

	@ApiProperty({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'suggestions_enabled' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { suggestions_enabled?: boolean; suggestionsEnabled?: boolean } }) =>
			obj.suggestions_enabled ?? obj.suggestionsEnabled,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: true })
	suggestionsEnabled: boolean;

	@ApiPropertyOptional({
		name: 'status_widgets',
		description: 'Ordered list of status widgets configured for this space',
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
	@Expose({ name: 'status_widgets' })
	@IsOptional()
	@IsArray()
	@Transform(
		({ obj }: { obj: { status_widgets?: unknown[] | null; statusWidgets?: unknown[] | null } }) =>
			obj.status_widgets ?? obj.statusWidgets ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'simple-json', nullable: true, default: null })
	statusWidgets: Record<string, unknown>[] | null;
}
