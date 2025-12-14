import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ScenesModuleUpdateSceneAction' })
export class UpdateSceneActionDto {
	@ApiProperty({ description: 'Action type (plugin identifier)', type: 'string', example: 'scenes-local' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	type: string;

	@ApiPropertyOptional({ description: 'Action execution order', type: 'integer', example: 0 })
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order?: number;

	@ApiPropertyOptional({
		description: 'Action configuration (plugin-specific)',
		type: 'object',
		additionalProperties: true,
		example: { deviceId: 'uuid', channelId: 'uuid', propertyId: 'uuid', value: true },
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"configuration","reason":"Configuration must be a valid object."}]' })
	configuration?: Record<string, unknown>;

	@ApiPropertyOptional({ description: 'Whether action is enabled', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqUpdateSceneAction' })
export class ReqUpdateSceneActionDto {
	@ApiProperty({ description: 'Action data', type: () => UpdateSceneActionDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneActionDto)
	data: UpdateSceneActionDto;
}
