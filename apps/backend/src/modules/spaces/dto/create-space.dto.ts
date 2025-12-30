import { Expose, Type } from 'class-transformer';
import {
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
	@ValidateIf((obj: CreateSpaceDto) => obj.type === SpaceType.ZONE || obj.category !== null && obj.category !== undefined)
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
	@IsOptional()
	@IsInt({ message: '[{"field":"display_order","reason":"Display order must be an integer."}]' })
	@Min(0, { message: '[{"field":"display_order","reason":"Display order must be at least 0."}]' })
	display_order?: number;

	@ApiPropertyOptional({
		name: 'primary_thermostat_id',
		description: 'ID of the primary thermostat device for this space (optional admin override)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"primary_thermostat_id","reason":"Primary thermostat ID must be a valid UUID."}]',
	})
	@ValidateIf((_, value) => value !== null)
	primary_thermostat_id?: string | null;

	@ApiPropertyOptional({
		name: 'primary_temperature_sensor_id',
		description: 'ID of the primary temperature sensor device for this space (optional admin override)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', {
		message:
			'[{"field":"primary_temperature_sensor_id","reason":"Primary temperature sensor ID must be a valid UUID."}]',
	})
	@ValidateIf((_, value) => value !== null)
	primary_temperature_sensor_id?: string | null;

	@ApiPropertyOptional({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"suggestions_enabled","reason":"Suggestions enabled must be a boolean."}]' })
	suggestions_enabled?: boolean;
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
