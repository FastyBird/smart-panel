import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SensorRole } from '../spaces.constants';

/**
 * DTO for setting a single sensor role assignment
 */
@ApiSchema({ name: 'SpacesModuleSetSensorRole' })
export class SetSensorRoleDto {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the sensor device',
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
		description: 'ID of the sensor channel within the device',
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

	@ApiPropertyOptional({
		description: 'The sensor role for this device/channel (null to remove role)',
		enum: SensorRole,
		example: SensorRole.ENVIRONMENT,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsEnum(SensorRole, { message: '[{"field":"role","reason":"Role must be a valid sensor role."}]' })
	role?: SensorRole | null;

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
 * Request wrapper for setting a single sensor role
 */
@ApiSchema({ name: 'SpacesModuleReqSetSensorRole' })
export class ReqSetSensorRoleDto {
	@ApiProperty({
		description: 'Sensor role assignment data',
		type: () => SetSensorRoleDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SetSensorRoleDto)
	data: SetSensorRoleDto;
}

/**
 * DTO for bulk setting sensor role assignments
 */
@ApiSchema({ name: 'SpacesModuleBulkSetSensorRoles' })
export class BulkSetSensorRolesDto {
	@ApiProperty({
		description: 'Array of sensor role assignments',
		type: () => [SetSensorRoleDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"roles","reason":"Roles must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"roles","reason":"Roles array must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => SetSensorRoleDto)
	roles: SetSensorRoleDto[];
}

/**
 * Request wrapper for bulk setting sensor roles
 */
@ApiSchema({ name: 'SpacesModuleReqBulkSetSensorRoles' })
export class ReqBulkSetSensorRolesDto {
	@ApiProperty({
		description: 'Bulk sensor role assignment data',
		type: () => BulkSetSensorRolesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkSetSensorRolesDto)
	data: BulkSetSensorRolesDto;
}
