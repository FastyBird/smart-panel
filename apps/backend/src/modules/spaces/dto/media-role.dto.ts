import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MediaRole } from '../spaces.constants';

/**
 * DTO for setting a single media role assignment
 */
@ApiSchema({ name: 'SpacesModuleSetMediaRole' })
export class SetMediaRoleDto {
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

	@ApiProperty({
		description: 'The media role for this device',
		enum: MediaRole,
		example: MediaRole.PRIMARY,
	})
	@Expose()
	@IsEnum(MediaRole, { message: '[{"field":"role","reason":"Role must be a valid media role."}]' })
	role: MediaRole;

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
 * Request wrapper for setting a single media role
 */
@ApiSchema({ name: 'SpacesModuleReqSetMediaRole' })
export class ReqSetMediaRoleDto {
	@ApiProperty({
		description: 'Media role assignment data',
		type: () => SetMediaRoleDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SetMediaRoleDto)
	data: SetMediaRoleDto;
}

/**
 * DTO for bulk setting media role assignments
 */
@ApiSchema({ name: 'SpacesModuleBulkSetMediaRoles' })
export class BulkSetMediaRolesDto {
	@ApiProperty({
		description: 'Array of media role assignments',
		type: () => [SetMediaRoleDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"roles","reason":"Roles must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"roles","reason":"Roles array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => SetMediaRoleDto)
	roles: SetMediaRoleDto[];
}

/**
 * Request wrapper for bulk setting media roles
 */
@ApiSchema({ name: 'SpacesModuleReqBulkSetMediaRoles' })
export class ReqBulkSetMediaRolesDto {
	@ApiProperty({
		description: 'Bulk media role assignment data',
		type: () => BulkSetMediaRolesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkSetMediaRolesDto)
	data: BulkSetMediaRolesDto;
}
