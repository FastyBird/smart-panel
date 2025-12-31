import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SCENES_LOCAL_TYPE } from '../scenes-local.constants';

@ApiSchema({ name: 'ScenesLocalPluginUpdateSceneAction' })
export class UpdateLocalSceneActionDto {
	@ApiProperty({
		description: 'Action type',
		type: 'string',
		default: SCENES_LOCAL_TYPE,
		example: SCENES_LOCAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid action type string."}]' })
	readonly type: typeof SCENES_LOCAL_TYPE = SCENES_LOCAL_TYPE;

	@ApiPropertyOptional({
		name: 'device_id',
		description: 'Target device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'device_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	device_id?: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'Target channel identifier (optional, auto-detected if omitted)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	channel_id?: string | null;

	@ApiPropertyOptional({
		name: 'property_id',
		description: 'Target property identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440002',
	})
	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { property_id?: string; propertyId?: string } }) => obj.property_id ?? obj.propertyId, {
		toClassOnly: true,
	})
	property_id?: string;

	@ApiPropertyOptional({
		description: 'Value to set on the property',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@IsOptional()
	@Transform(({ value }: { value: unknown }) => {
		if (value === undefined) return undefined;
		if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
			return value;
		}
		// For other types, convert to string representation
		return JSON.stringify(value);
	})
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
