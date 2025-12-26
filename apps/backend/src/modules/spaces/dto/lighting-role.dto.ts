import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { LightingRole } from '../spaces.constants';

/**
 * DTO for setting a single lighting role assignment
 */
@ApiSchema({ name: 'SpacesModuleSetLightingRole' })
export class SetLightingRoleDto {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the lighting device',
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

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the light channel within the device',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	channelId: string;

	@ApiProperty({
		description: 'The lighting role for this device/channel',
		enum: LightingRole,
		example: LightingRole.MAIN,
	})
	@Expose()
	@IsEnum(LightingRole, { message: '[{"field":"role","reason":"Role must be a valid lighting role."}]' })
	role: LightingRole;

	@ApiPropertyOptional({
		description: 'Priority for selecting defaults within the same role (lower = higher priority)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"priority","reason":"Priority must be an integer."}]' })
	@Min(0, { message: '[{"field":"priority","reason":"Priority must be non-negative."}]' })
	priority?: number;
}

/**
 * Request wrapper for setting a single lighting role
 */
@ApiSchema({ name: 'SpacesModuleReqSetLightingRole' })
export class ReqSetLightingRoleDto {
	@ApiProperty({
		description: 'Lighting role assignment data',
		type: () => SetLightingRoleDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SetLightingRoleDto)
	data: SetLightingRoleDto;
}

/**
 * DTO for bulk setting lighting role assignments
 */
@ApiSchema({ name: 'SpacesModuleBulkSetLightingRoles' })
export class BulkSetLightingRolesDto {
	@ApiProperty({
		description: 'Array of lighting role assignments',
		type: () => [SetLightingRoleDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"roles","reason":"Roles must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"roles","reason":"Roles array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => SetLightingRoleDto)
	roles: SetLightingRoleDto[];
}

/**
 * Request wrapper for bulk setting lighting roles
 */
@ApiSchema({ name: 'SpacesModuleReqBulkSetLightingRoles' })
export class ReqBulkSetLightingRolesDto {
	@ApiProperty({
		description: 'Bulk lighting role assignment data',
		type: () => BulkSetLightingRolesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkSetLightingRolesDto)
	data: BulkSetLightingRolesDto;
}
