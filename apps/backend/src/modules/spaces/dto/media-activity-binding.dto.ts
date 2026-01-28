import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MediaActivityKey } from '../spaces.constants';

/**
 * DTO for creating a media activity binding
 */
@ApiSchema({ name: 'SpacesModuleCreateMediaActivityBinding' })
export class CreateMediaActivityBindingDto {
	@ApiProperty({
		name: 'activity_key',
		description: 'The activity this binding configures',
		enum: MediaActivityKey,
		example: MediaActivityKey.WATCH,
	})
	@Expose({ name: 'activity_key' })
	@IsEnum(MediaActivityKey, {
		message: '[{"field":"activity_key","reason":"Activity key must be one of: watch, listen, gaming, background, off."}]',
	})
	@Transform(
		({ obj }: { obj: { activity_key?: string; activityKey?: string } }) => obj.activity_key ?? obj.activityKey,
		{ toClassOnly: true },
	)
	activityKey: MediaActivityKey;

	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'Derived endpoint ID for the display slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	displayEndpointId?: string;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'Derived endpoint ID for the audio output slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	audioEndpointId?: string;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'Derived endpoint ID for the source slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	sourceEndpointId?: string;

	@ApiPropertyOptional({
		name: 'remote_endpoint_id',
		description: 'Derived endpoint ID for the remote target slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'remote_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"remote_endpoint_id","reason":"Remote endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"remote_endpoint_id","reason":"Remote endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { remote_endpoint_id?: string; remoteEndpointId?: string } }) =>
			obj.remote_endpoint_id ?? obj.remoteEndpointId,
		{ toClassOnly: true },
	)
	remoteEndpointId?: string;

	@ApiPropertyOptional({
		name: 'display_input_id',
		description: 'Input to select on the display (e.g. HDMI1). Only valid if display supports inputSelect.',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'display_input_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"display_input_id","reason":"Display input ID must be a string."}]',
	})
	@MaxLength(50, {
		message: '[{"field":"display_input_id","reason":"Display input ID must not exceed 50 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { display_input_id?: string; displayInputId?: string } }) =>
			obj.display_input_id ?? obj.displayInputId,
		{ toClassOnly: true },
	)
	displayInputId?: string;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
	})
	@Expose({ name: 'audio_volume_preset' })
	@IsOptional()
	@IsInt({
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be an integer."}]',
	})
	@Min(0, {
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be at least 0."}]',
	})
	@Max(100, {
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must not exceed 100."}]',
	})
	@Transform(
		({ obj }: { obj: { audio_volume_preset?: number; audioVolumePreset?: number } }) =>
			obj.audio_volume_preset ?? obj.audioVolumePreset,
		{ toClassOnly: true },
	)
	audioVolumePreset?: number;
}

/**
 * Request wrapper for creating a media activity binding
 */
@ApiSchema({ name: 'SpacesModuleReqCreateMediaActivityBinding' })
export class ReqCreateMediaActivityBindingDto {
	@ApiProperty({
		description: 'Media activity binding data',
		type: () => CreateMediaActivityBindingDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateMediaActivityBindingDto)
	data: CreateMediaActivityBindingDto;
}

/**
 * DTO for updating a media activity binding
 */
@ApiSchema({ name: 'SpacesModuleUpdateMediaActivityBinding' })
export class UpdateMediaActivityBindingDto {
	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'Derived endpoint ID for the display slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	displayEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'Derived endpoint ID for the audio output slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	audioEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'Derived endpoint ID for the source slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	sourceEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'remote_endpoint_id',
		description: 'Derived endpoint ID for the remote target slot',
		type: 'string',
		maxLength: 255,
	})
	@Expose({ name: 'remote_endpoint_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"remote_endpoint_id","reason":"Remote endpoint ID must be a string."}]',
	})
	@MaxLength(255, {
		message: '[{"field":"remote_endpoint_id","reason":"Remote endpoint ID must not exceed 255 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { remote_endpoint_id?: string; remoteEndpointId?: string } }) =>
			obj.remote_endpoint_id ?? obj.remoteEndpointId,
		{ toClassOnly: true },
	)
	remoteEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'display_input_id',
		description: 'Input to select on the display',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'display_input_id' })
	@IsOptional()
	@IsString({
		message: '[{"field":"display_input_id","reason":"Display input ID must be a string."}]',
	})
	@MaxLength(50, {
		message: '[{"field":"display_input_id","reason":"Display input ID must not exceed 50 characters."}]',
	})
	@Transform(
		({ obj }: { obj: { display_input_id?: string; displayInputId?: string } }) =>
			obj.display_input_id ?? obj.displayInputId,
		{ toClassOnly: true },
	)
	displayInputId?: string | null;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
	})
	@Expose({ name: 'audio_volume_preset' })
	@IsOptional()
	@IsInt({
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be an integer."}]',
	})
	@Min(0, {
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be at least 0."}]',
	})
	@Max(100, {
		message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must not exceed 100."}]',
	})
	@Transform(
		({ obj }: { obj: { audio_volume_preset?: number; audioVolumePreset?: number } }) =>
			obj.audio_volume_preset ?? obj.audioVolumePreset,
		{ toClassOnly: true },
	)
	audioVolumePreset?: number | null;
}

/**
 * Request wrapper for updating a media activity binding
 */
@ApiSchema({ name: 'SpacesModuleReqUpdateMediaActivityBinding' })
export class ReqUpdateMediaActivityBindingDto {
	@ApiProperty({
		description: 'Media activity binding update data',
		type: () => UpdateMediaActivityBindingDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateMediaActivityBindingDto)
	data: UpdateMediaActivityBindingDto;
}
