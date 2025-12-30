import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SceneCategory } from '../scenes.constants';

@ApiSchema({ name: 'ScenesModuleUpdateScene' })
export class UpdateSceneDto {
	@ApiProperty({ description: 'Scene type (plugin identifier)', type: 'string', example: 'scenes-local' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported scene type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported scene type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		name: 'space_id',
		description: 'Room space identifier this scene belongs to',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	spaceId?: string;

	@ApiPropertyOptional({ description: 'Scene category', enum: SceneCategory, example: SceneCategory.GENERIC })
	@Expose()
	@IsOptional()
	@IsEnum(SceneCategory, {
		message: '[{"field":"category","reason":"Category must be a valid scene category."}]',
	})
	category?: SceneCategory;

	@ApiPropertyOptional({ description: 'Scene name', type: 'string', example: 'Movie Night' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string;

	@ApiPropertyOptional({
		description: 'Scene description',
		type: 'string',
		example: 'Dims lights and sets TV to movie mode',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Scene icon identifier',
		type: 'string',
		example: 'mdi:movie',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		name: 'display_order',
		description: 'Display order for UI',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsOptional()
	@IsInt({ message: '[{"field":"display_order","reason":"Display order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"display_order","reason":"Display order must be a non-negative integer."}]' })
	@Transform(
		({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder,
		{ toClassOnly: true },
	)
	displayOrder?: number;

	@ApiPropertyOptional({ description: 'Whether scene is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		name: 'is_triggerable',
		description: 'Whether scene can be manually triggered',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_triggerable' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"is_triggerable","reason":"Is triggerable must be a valid true or false."}]' })
	@Transform(
		({ obj }: { obj: { is_triggerable?: boolean; isTriggerable?: boolean } }) =>
			obj.is_triggerable ?? obj.isTriggerable,
		{ toClassOnly: true },
	)
	isTriggerable?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqUpdateScene' })
export class ReqUpdateSceneDto {
	@ApiProperty({ description: 'Scene data', type: () => UpdateSceneDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneDto)
	data: UpdateSceneDto;
}
