import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, ValidateIf, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateSpaceDto } from '../../../modules/spaces/dto/update-space.dto';
import {
	ALL_SPACE_CATEGORIES,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from '../../../modules/spaces/spaces.constants';
import { IsValidSpaceCategory } from '../validators/space-category-constraint.validator';

import { StatusWidgetDto } from './status-widget.dto';

/**
 * Update DTO for home-control spaces (rooms and zones). Adds the
 * category / suggestions_enabled / status_widgets fields that only
 * apply to the home-control plugin's space types.
 */
@ApiSchema({ name: 'SpacesHomeControlPluginUpdateHomeControlSpace' })
export class UpdateHomeControlSpaceDto extends UpdateSpaceDto {
	@ApiPropertyOptional({
		description:
			'Space category. For type=room: room categories (living_room, bedroom, etc.). For type=zone: zone categories (floor_ground, outdoor_garden, etc.). Required for zones.',
		enum: ALL_SPACE_CATEGORIES,
		nullable: true,
		example: 'living_room',
	})
	@Expose()
	@ValidateIf(
		(obj: UpdateHomeControlSpaceDto) =>
			obj.type === SpaceType.ZONE || (obj.category !== null && obj.category !== undefined),
	)
	@IsNotEmpty({ message: '[{"field":"category","reason":"Category is required for zones."}]' })
	@IsValidSpaceCategory()
	category?: SpaceRoomCategory | SpaceZoneCategory | null;

	@ApiPropertyOptional({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"suggestions_enabled","reason":"Suggestions enabled must be a boolean."}]' })
	suggestions_enabled?: boolean;

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
	@Expose()
	@IsOptional()
	@IsArray({
		message: '[{"field":"status_widgets","reason":"Status widgets must be an array."}]',
	})
	@ValidateNested({ each: true })
	@Type(() => StatusWidgetDto)
	@ValidateIf((_, value) => value !== null)
	status_widgets?: StatusWidgetDto[] | null;
}
