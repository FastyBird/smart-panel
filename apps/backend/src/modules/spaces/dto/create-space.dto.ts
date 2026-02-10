import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ALL_SPACE_CATEGORIES, SpaceCategory, SpaceType } from '../spaces.constants';
import { IsValidSpaceCategory } from '../validators/space-category-constraint.validator';

@ApiSchema({ name: 'SpacesModuleCreateSpace' })
export class CreateSpaceDto {
	@ApiPropertyOptional({
		description: 'Optional space ID (UUID v4)',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name is required."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Space description',
		type: 'string',
		nullable: true,
		example: 'Main living area on the ground floor',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"description","reason":"Description must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiProperty({
		description: 'Space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type is required."}]' })
	@IsEnum(SpaceType, { message: '[{"field":"type","reason":"Type must be a valid space type."}]' })
	type: SpaceType;

	@ApiPropertyOptional({
		description:
			'Space category. For type=room: room categories (living_room, bedroom, etc.). For type=zone: zone categories (floor_ground, outdoor_garden, etc.). Required for zones.',
		enum: ALL_SPACE_CATEGORIES,
		nullable: true,
		example: 'living_room',
	})
	@Expose()
	@ValidateIf(
		(obj: CreateSpaceDto) => obj.type === SpaceType.ZONE || (obj.category !== null && obj.category !== undefined),
	)
	@IsNotEmpty({ message: '[{"field":"category","reason":"Category is required for zones."}]' })
	@IsValidSpaceCategory()
	category?: SpaceCategory | null;

	@ApiPropertyOptional({
		description: 'Icon identifier for the space',
		type: 'string',
		nullable: true,
		example: 'mdi:sofa',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		name: 'parent_id',
		description: 'Parent zone ID (only for rooms). Rooms can optionally belong to a zone.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"parent_id","reason":"Parent ID must be a valid UUID."}]' })
	@ValidateIf((_, value) => value !== null)
	parent_id?: string | null;

	@ApiPropertyOptional({
		name: 'display_order',
		description: 'Display order for sorting spaces',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"display_order","reason":"Display order must be an integer."}]' })
	@Min(0, { message: '[{"field":"display_order","reason":"Display order must be at least 0."}]' })
	display_order?: number;

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
	@Expose()
	@IsOptional()
	@IsArray({
		message: '[{"field":"header_widgets","reason":"Header widgets must be an array."}]',
	})
	header_widgets?: Record<string, unknown>[] | null;
}

@ApiSchema({ name: 'SpacesModuleReqCreateSpace' })
export class ReqCreateSpaceDto {
	@ApiProperty({
		description: 'Space creation data',
		type: () => CreateSpaceDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateSpaceDto)
	data: CreateSpaceDto;
}
