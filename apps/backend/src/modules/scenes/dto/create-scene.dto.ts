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

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { SceneCategory } from '../scenes.constants';

import { CreateSceneActionDto } from './create-scene-action.dto';

@ApiSchema({ name: 'ScenesModuleCreateScene' })
export class CreateSceneDto {
	@ApiPropertyOptional({
		description: 'Scene ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiPropertyOptional({
		description: 'Primary space identifier this scene belongs to',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"primary_space_id","reason":"Primary space ID must be a valid UUID (version 4)."}]',
	})
	@ValidateIf((_, value) => value !== null)
	primary_space_id?: string | null;

	@ApiPropertyOptional({ description: 'Scene category', enum: SceneCategory, example: SceneCategory.GENERIC })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(SceneCategory, {
		message: '[{"field":"category","reason":"Category must be a valid scene category."}]',
	})
	category?: SceneCategory;

	@ApiProperty({ description: 'Scene name', type: 'string', example: 'Movie Night' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

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
		description: 'Display order for UI',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order?: number;

	@ApiPropertyOptional({ description: 'Whether scene is enabled', type: 'boolean', example: true })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Whether scene can be manually triggered',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"triggerable","reason":"Triggerable must be a valid true or false."}]' })
	triggerable?: boolean;

	@ApiPropertyOptional({
		description: 'Scene actions',
		type: 'array',
		items: { $ref: getSchemaPath(CreateSceneActionDto) },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"actions","reason":"Actions must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateSceneActionDto)
	actions?: CreateSceneActionDto[];
}

@ApiSchema({ name: 'ScenesModuleReqCreateScene' })
export class ReqCreateSceneDto {
	@ApiProperty({ description: 'Scene data', type: () => CreateSceneDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSceneDto)
	data: CreateSceneDto;
}
