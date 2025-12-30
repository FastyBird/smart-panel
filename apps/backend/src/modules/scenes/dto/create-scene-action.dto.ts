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

	@ApiProperty({ description: 'Action type (plugin identifier)', type: 'string', example: 'scenes-local' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported action type."}]',
	})
	type: string;

	@ApiProperty({
		name: 'device_id',
		description: 'Target device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@Expose({ name: 'device_id' })
	@IsNotEmpty({ message: '[{"field":"device_id","reason":"Device ID is required."}]' })
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	deviceId: string;

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

	@ApiProperty({
		name: 'property_id',
		description: 'Target property identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440003',
	})
	@Expose({ name: 'property_id' })
	@IsNotEmpty({ message: '[{"field":"property_id","reason":"Property ID is required."}]' })
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { property_id?: string; propertyId?: string } }) => obj.property_id ?? obj.propertyId, {
		toClassOnly: true,
	})
	propertyId: string;

	@ApiProperty({
		description: 'Target value to set',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"value","reason":"Value is required."}]' })
	value: string | number | boolean;

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
