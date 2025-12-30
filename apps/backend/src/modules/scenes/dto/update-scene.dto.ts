import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

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
