import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CoversRole } from '../spaces.constants';

/**
 * DTO for setting a single covers role assignment
 */
@ApiSchema({ name: 'SpacesModuleSetCoversRole' })
export class SetCoversRoleDto {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the window covering device',
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
		description: 'ID of the window covering channel within the device',
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
		description: 'The covers role for this device/channel',
		enum: CoversRole,
		example: CoversRole.PRIMARY,
	})
	@Expose()
	@IsEnum(CoversRole, { message: '[{"field":"role","reason":"Role must be a valid covers role."}]' })
	role: CoversRole;

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
 * Request wrapper for setting a single covers role
 */
@ApiSchema({ name: 'SpacesModuleReqSetCoversRole' })
export class ReqSetCoversRoleDto {
	@ApiProperty({
		description: 'Covers role assignment data',
		type: () => SetCoversRoleDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SetCoversRoleDto)
	data: SetCoversRoleDto;
}

/**
 * DTO for bulk setting covers role assignments
 */
@ApiSchema({ name: 'SpacesModuleBulkSetCoversRoles' })
export class BulkSetCoversRolesDto {
	@ApiProperty({
		description: 'Array of covers role assignments',
		type: () => [SetCoversRoleDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"roles","reason":"Roles must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"roles","reason":"Roles array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => SetCoversRoleDto)
	roles: SetCoversRoleDto[];
}

/**
 * Request wrapper for bulk setting covers roles
 */
@ApiSchema({ name: 'SpacesModuleReqBulkSetCoversRoles' })
export class ReqBulkSetCoversRolesDto {
	@ApiProperty({
		description: 'Bulk covers role assignment data',
		type: () => BulkSetCoversRolesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkSetCoversRolesDto)
	data: BulkSetCoversRolesDto;
}
