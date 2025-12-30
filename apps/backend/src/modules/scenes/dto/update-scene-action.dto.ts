import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
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

	@ApiPropertyOptional({
		name: 'device_id',
		description: 'Target device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@Expose({ name: 'device_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	deviceId?: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'Target channel identifier (optional if device has single channel)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440002',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@ValidateIf((o: { channelId?: string | null }) => o.channelId !== null && o.channelId !== undefined)
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID (version 4)."}]' })
	@Transform(
		({ obj }: { obj: { channel_id?: string | null; channelId?: string | null } }) =>
			obj.channel_id ?? obj.channelId ?? null,
		{ toClassOnly: true },
	)
	channelId?: string | null;

	@ApiPropertyOptional({
		name: 'property_id',
		description: 'Target property identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440003',
	})
	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { property_id?: string; propertyId?: string } }) => obj.property_id ?? obj.propertyId, {
		toClassOnly: true,
	})
	propertyId?: string;

	@ApiPropertyOptional({
		description: 'Target value to set',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@IsOptional()
	value?: string | number | boolean;

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

@ApiSchema({ name: 'ScenesModuleReqUpdateSceneAction' })
export class ReqUpdateSceneActionDto {
	@ApiProperty({ description: 'Action data', type: () => UpdateSceneActionDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSceneActionDto)
	data: UpdateSceneActionDto;
}
