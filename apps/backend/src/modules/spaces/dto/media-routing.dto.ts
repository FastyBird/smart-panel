import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MediaPowerPolicy, MediaRoutingType } from '../spaces.constants';

/**
 * DTO for creating a media routing
 */
@ApiSchema({ name: 'SpacesModuleCreateMediaRouting' })
export class CreateMediaRoutingDto {
	@ApiProperty({
		description: 'The type of this routing',
		enum: MediaRoutingType,
		example: MediaRoutingType.WATCH,
	})
	@Expose()
	@IsEnum(MediaRoutingType, { message: '[{"field":"type","reason":"Type must be a valid routing type."}]' })
	type: MediaRoutingType;

	@ApiProperty({
		description: 'Display name for this routing',
		type: 'string',
		maxLength: 100,
		example: 'Watch TV',
	})
	@Expose()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@MaxLength(100, { message: '[{"field":"name","reason":"Name must not exceed 100 characters."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Icon identifier for this routing',
		type: 'string',
		maxLength: 50,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"icon","reason":"Icon must not exceed 50 characters."}]' })
	icon?: string;

	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'ID of the display endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	displayEndpointId?: string;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'ID of the audio output endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	audioEndpointId?: string;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'ID of the source endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	sourceEndpointId?: string;

	@ApiPropertyOptional({
		name: 'remote_target_endpoint_id',
		description: 'ID of the remote target endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'remote_target_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"remote_target_endpoint_id","reason":"Remote target endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { remote_target_endpoint_id?: string; remoteTargetEndpointId?: string } }) =>
			obj.remote_target_endpoint_id ?? obj.remoteTargetEndpointId,
		{ toClassOnly: true },
	)
	remoteTargetEndpointId?: string;

	@ApiPropertyOptional({
		name: 'display_input',
		description: 'Input to switch to on the display',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'display_input' })
	@IsOptional()
	@IsString({ message: '[{"field":"display_input","reason":"Display input must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"display_input","reason":"Display input must not exceed 50 characters."}]' })
	@Transform(({ obj }: { obj: { display_input?: string; displayInput?: string } }) => obj.display_input ?? obj.displayInput, {
		toClassOnly: true,
	})
	displayInput?: string;

	@ApiPropertyOptional({
		name: 'audio_input',
		description: 'Input to switch to on the audio device',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'audio_input' })
	@IsOptional()
	@IsString({ message: '[{"field":"audio_input","reason":"Audio input must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"audio_input","reason":"Audio input must not exceed 50 characters."}]' })
	@Transform(({ obj }: { obj: { audio_input?: string; audioInput?: string } }) => obj.audio_input ?? obj.audioInput, {
		toClassOnly: true,
	})
	audioInput?: string;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100) when activating',
		type: 'integer',
		minimum: 0,
		maximum: 100,
	})
	@Expose({ name: 'audio_volume_preset' })
	@IsOptional()
	@IsInt({ message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be an integer."}]' })
	@Min(0, { message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be at least 0."}]' })
	@Max(100, { message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must not exceed 100."}]' })
	@Transform(
		({ obj }: { obj: { audio_volume_preset?: number; audioVolumePreset?: number } }) =>
			obj.audio_volume_preset ?? obj.audioVolumePreset,
		{ toClassOnly: true },
	)
	audioVolumePreset?: number;

	@ApiPropertyOptional({
		name: 'power_policy',
		description: 'How power is handled when activating',
		enum: MediaPowerPolicy,
	})
	@Expose({ name: 'power_policy' })
	@IsOptional()
	@IsEnum(MediaPowerPolicy, { message: '[{"field":"power_policy","reason":"Power policy must be a valid policy."}]' })
	@Transform(({ obj }: { obj: { power_policy?: string; powerPolicy?: string } }) => obj.power_policy ?? obj.powerPolicy, {
		toClassOnly: true,
	})
	powerPolicy?: MediaPowerPolicy;
}

/**
 * Request wrapper for creating a media routing
 */
@ApiSchema({ name: 'SpacesModuleReqCreateMediaRouting' })
export class ReqCreateMediaRoutingDto {
	@ApiProperty({
		description: 'Media routing data',
		type: () => CreateMediaRoutingDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateMediaRoutingDto)
	data: CreateMediaRoutingDto;
}

/**
 * DTO for updating a media routing
 */
@ApiSchema({ name: 'SpacesModuleUpdateMediaRouting' })
export class UpdateMediaRoutingDto {
	@ApiPropertyOptional({
		description: 'Display name for this routing',
		type: 'string',
		maxLength: 100,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@MaxLength(100, { message: '[{"field":"name","reason":"Name must not exceed 100 characters."}]' })
	name?: string;

	@ApiPropertyOptional({
		description: 'Icon identifier for this routing',
		type: 'string',
		maxLength: 50,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"icon","reason":"Icon must not exceed 50 characters."}]' })
	icon?: string;

	@ApiPropertyOptional({
		name: 'display_endpoint_id',
		description: 'ID of the display endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'display_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"display_endpoint_id","reason":"Display endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { display_endpoint_id?: string; displayEndpointId?: string } }) =>
			obj.display_endpoint_id ?? obj.displayEndpointId,
		{ toClassOnly: true },
	)
	displayEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'audio_endpoint_id',
		description: 'ID of the audio output endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'audio_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"audio_endpoint_id","reason":"Audio endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { audio_endpoint_id?: string; audioEndpointId?: string } }) =>
			obj.audio_endpoint_id ?? obj.audioEndpointId,
		{ toClassOnly: true },
	)
	audioEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'source_endpoint_id',
		description: 'ID of the source endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'source_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"source_endpoint_id","reason":"Source endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { source_endpoint_id?: string; sourceEndpointId?: string } }) =>
			obj.source_endpoint_id ?? obj.sourceEndpointId,
		{ toClassOnly: true },
	)
	sourceEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'remote_target_endpoint_id',
		description: 'ID of the remote target endpoint for this routing',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'remote_target_endpoint_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"remote_target_endpoint_id","reason":"Remote target endpoint ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { remote_target_endpoint_id?: string; remoteTargetEndpointId?: string } }) =>
			obj.remote_target_endpoint_id ?? obj.remoteTargetEndpointId,
		{ toClassOnly: true },
	)
	remoteTargetEndpointId?: string | null;

	@ApiPropertyOptional({
		name: 'display_input',
		description: 'Input to switch to on the display',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'display_input' })
	@IsOptional()
	@IsString({ message: '[{"field":"display_input","reason":"Display input must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"display_input","reason":"Display input must not exceed 50 characters."}]' })
	@Transform(({ obj }: { obj: { display_input?: string; displayInput?: string } }) => obj.display_input ?? obj.displayInput, {
		toClassOnly: true,
	})
	displayInput?: string | null;

	@ApiPropertyOptional({
		name: 'audio_input',
		description: 'Input to switch to on the audio device',
		type: 'string',
		maxLength: 50,
	})
	@Expose({ name: 'audio_input' })
	@IsOptional()
	@IsString({ message: '[{"field":"audio_input","reason":"Audio input must be a string."}]' })
	@MaxLength(50, { message: '[{"field":"audio_input","reason":"Audio input must not exceed 50 characters."}]' })
	@Transform(({ obj }: { obj: { audio_input?: string; audioInput?: string } }) => obj.audio_input ?? obj.audioInput, {
		toClassOnly: true,
	})
	audioInput?: string | null;

	@ApiPropertyOptional({
		name: 'audio_volume_preset',
		description: 'Default volume level (0-100) when activating',
		type: 'integer',
		minimum: 0,
		maximum: 100,
	})
	@Expose({ name: 'audio_volume_preset' })
	@IsOptional()
	@IsInt({ message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be an integer."}]' })
	@Min(0, { message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must be at least 0."}]' })
	@Max(100, { message: '[{"field":"audio_volume_preset","reason":"Audio volume preset must not exceed 100."}]' })
	@Transform(
		({ obj }: { obj: { audio_volume_preset?: number; audioVolumePreset?: number } }) =>
			obj.audio_volume_preset ?? obj.audioVolumePreset,
		{ toClassOnly: true },
	)
	audioVolumePreset?: number | null;

	@ApiPropertyOptional({
		name: 'power_policy',
		description: 'How power is handled when activating',
		enum: MediaPowerPolicy,
	})
	@Expose({ name: 'power_policy' })
	@IsOptional()
	@IsEnum(MediaPowerPolicy, { message: '[{"field":"power_policy","reason":"Power policy must be a valid policy."}]' })
	@Transform(({ obj }: { obj: { power_policy?: string; powerPolicy?: string } }) => obj.power_policy ?? obj.powerPolicy, {
		toClassOnly: true,
	})
	powerPolicy?: MediaPowerPolicy;

	@ApiPropertyOptional({
		name: 'is_default',
		description: 'Whether this is an auto-created default routing',
		type: 'boolean',
	})
	@Expose({ name: 'is_default' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"is_default","reason":"Is default must be a boolean."}]' })
	@Transform(({ obj }: { obj: { is_default?: boolean; isDefault?: boolean } }) => obj.is_default ?? obj.isDefault, {
		toClassOnly: true,
	})
	isDefault?: boolean;
}

/**
 * Request wrapper for updating a media routing
 */
@ApiSchema({ name: 'SpacesModuleReqUpdateMediaRouting' })
export class ReqUpdateMediaRoutingDto {
	@ApiProperty({
		description: 'Media routing update data',
		type: () => UpdateMediaRoutingDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateMediaRoutingDto)
	data: UpdateMediaRoutingDto;
}

/**
 * DTO for activating a media routing
 */
@ApiSchema({ name: 'SpacesModuleActivateMediaRouting' })
export class ActivateMediaRoutingDto {
	@ApiProperty({
		name: 'routing_id',
		description: 'ID of the routing to activate',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'routing_id' })
	@IsUUID('4', { message: '[{"field":"routing_id","reason":"Routing ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { routing_id?: string; routingId?: string } }) => obj.routing_id ?? obj.routingId, {
		toClassOnly: true,
	})
	routingId: string;
}

/**
 * Request wrapper for activating a media routing
 */
@ApiSchema({ name: 'SpacesModuleReqActivateMediaRouting' })
export class ReqActivateMediaRoutingDto {
	@ApiProperty({
		description: 'Routing activation data',
		type: () => ActivateMediaRoutingDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ActivateMediaRoutingDto)
	data: ActivateMediaRoutingDto;
}
