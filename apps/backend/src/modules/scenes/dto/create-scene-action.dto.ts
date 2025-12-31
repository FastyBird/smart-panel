import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ScenesModuleCreateSceneAction' })
export class CreateSceneActionDto {
	@ApiPropertyOptional({
		description: 'Action ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Action type (plugin identifier)', type: 'string', example: 'local' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	type: string;

	@ApiProperty({
		description: 'Action configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { device_id: 'uuid', property_id: 'uuid', value: true },
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"configuration","reason":"Configuration is required."}]' })
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Action execution order', type: 'integer', example: 0 })
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order?: number;

	@ApiPropertyOptional({ description: 'Whether action is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqCreateSceneAction' })
export class ReqCreateSceneActionDto {
	@ApiProperty({ description: 'Action data', type: () => CreateSceneActionDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateSceneActionDto)
	data: CreateSceneActionDto;
}
