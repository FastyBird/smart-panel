import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsEnum,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MediaEndpointType } from '../spaces.constants';

/**
 * DTO for creating a media endpoint
 */
@ApiSchema({ name: 'SpacesModuleCreateMediaEndpoint' })
export class CreateMediaEndpointDto {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the media device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	deviceId: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the specific channel for this endpoint',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	channelId?: string;

	@ApiProperty({
		description: 'The functional type of this endpoint',
		enum: MediaEndpointType,
		example: MediaEndpointType.DISPLAY,
	})
	@Expose()
	@IsEnum(MediaEndpointType, { message: '[{"field":"type","reason":"Type must be a valid endpoint type."}]' })
	type: MediaEndpointType;

	@ApiPropertyOptional({
		description: 'Custom name for this endpoint',
		type: 'string',
		maxLength: 100,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@MaxLength(100, { message: '[{"field":"name","reason":"Name must not exceed 100 characters."}]' })
	name?: string;

	@ApiPropertyOptional({
		name: 'preferred_for',
		description: 'Array of routing types this endpoint is preferred for',
		type: 'array',
		items: { type: 'string' },
		example: ['watch', 'gaming'],
	})
	@Expose({ name: 'preferred_for' })
	@IsOptional()
	@IsArray({ message: '[{"field":"preferred_for","reason":"Preferred for must be an array."}]' })
	@IsString({ each: true, message: '[{"field":"preferred_for","reason":"Each value must be a string."}]' })
	@Transform(
		({ obj }: { obj: { preferred_for?: string[]; preferredFor?: string[] } }) => obj.preferred_for ?? obj.preferredFor,
		{
			toClassOnly: true,
		},
	)
	preferredFor?: string[];
}

/**
 * Request wrapper for creating a media endpoint
 */
@ApiSchema({ name: 'SpacesModuleReqCreateMediaEndpoint' })
export class ReqCreateMediaEndpointDto {
	@ApiProperty({
		description: 'Media endpoint data',
		type: () => CreateMediaEndpointDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateMediaEndpointDto)
	data: CreateMediaEndpointDto;
}

/**
 * DTO for updating a media endpoint
 */
@ApiSchema({ name: 'SpacesModuleUpdateMediaEndpoint' })
export class UpdateMediaEndpointDto {
	@ApiPropertyOptional({
		description: 'Custom name for this endpoint',
		type: 'string',
		maxLength: 100,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@MaxLength(100, { message: '[{"field":"name","reason":"Name must not exceed 100 characters."}]' })
	name?: string;

	@ApiPropertyOptional({
		name: 'preferred_for',
		description: 'Array of routing types this endpoint is preferred for',
		type: 'array',
		items: { type: 'string' },
	})
	@Expose({ name: 'preferred_for' })
	@IsOptional()
	@IsArray({ message: '[{"field":"preferred_for","reason":"Preferred for must be an array."}]' })
	@IsString({ each: true, message: '[{"field":"preferred_for","reason":"Each value must be a string."}]' })
	@Transform(
		({ obj }: { obj: { preferred_for?: string[]; preferredFor?: string[] } }) => obj.preferred_for ?? obj.preferredFor,
		{
			toClassOnly: true,
		},
	)
	preferredFor?: string[];
}

/**
 * Request wrapper for updating a media endpoint
 */
@ApiSchema({ name: 'SpacesModuleReqUpdateMediaEndpoint' })
export class ReqUpdateMediaEndpointDto {
	@ApiProperty({
		description: 'Media endpoint update data',
		type: () => UpdateMediaEndpointDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateMediaEndpointDto)
	data: UpdateMediaEndpointDto;
}

/**
 * DTO for bulk creating media endpoints
 */
@ApiSchema({ name: 'SpacesModuleBulkCreateMediaEndpoints' })
export class BulkCreateMediaEndpointsDto {
	@ApiProperty({
		description: 'Array of media endpoints to create',
		type: () => [CreateMediaEndpointDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"endpoints","reason":"Endpoints must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"endpoints","reason":"Endpoints array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateMediaEndpointDto)
	endpoints: CreateMediaEndpointDto[];
}

/**
 * Request wrapper for bulk creating media endpoints
 */
@ApiSchema({ name: 'SpacesModuleReqBulkCreateMediaEndpoints' })
export class ReqBulkCreateMediaEndpointsDto {
	@ApiProperty({
		description: 'Bulk media endpoint creation data',
		type: () => BulkCreateMediaEndpointsDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkCreateMediaEndpointsDto)
	data: BulkCreateMediaEndpointsDto;
}
