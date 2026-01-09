import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ClimateRole } from '../spaces.constants';

/**
 * DTO for setting a single climate role assignment
 */
@ApiSchema({ name: 'SpacesModuleSetClimateRole' })
export class SetClimateRoleDto {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the climate device',
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
		description: 'ID of the channel (required for sensor roles, null for actuator roles)',
		type: 'string',
		format: 'uuid',
		example: 'c3d29ea4-632f-5e8c-c4gf-dce8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	channelId?: string | null;

	@ApiProperty({
		description: 'The climate role for this device/channel',
		enum: ClimateRole,
		example: ClimateRole.PRIMARY,
	})
	@Expose()
	@IsEnum(ClimateRole, { message: '[{"field":"role","reason":"Role must be a valid climate role."}]' })
	role: ClimateRole;

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
 * Request wrapper for setting a single climate role
 */
@ApiSchema({ name: 'SpacesModuleReqSetClimateRole' })
export class ReqSetClimateRoleDto {
	@ApiProperty({
		description: 'Climate role assignment data',
		type: () => SetClimateRoleDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SetClimateRoleDto)
	data: SetClimateRoleDto;
}

/**
 * DTO for bulk setting climate role assignments
 */
@ApiSchema({ name: 'SpacesModuleBulkSetClimateRoles' })
export class BulkSetClimateRolesDto {
	@ApiProperty({
		description: 'Array of climate role assignments',
		type: () => [SetClimateRoleDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"roles","reason":"Roles must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"roles","reason":"Roles array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => SetClimateRoleDto)
	roles: SetClimateRoleDto[];
}

/**
 * Request wrapper for bulk setting climate roles
 */
@ApiSchema({ name: 'SpacesModuleReqBulkSetClimateRoles' })
export class ReqBulkSetClimateRolesDto {
	@ApiProperty({
		description: 'Bulk climate role assignment data',
		type: () => BulkSetClimateRolesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkSetClimateRolesDto)
	data: BulkSetClimateRolesDto;
}
