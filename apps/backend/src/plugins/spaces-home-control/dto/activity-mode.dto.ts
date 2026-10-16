import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ActivityConfigurationModel } from '../models/activity-configuration.model';

@ApiSchema({ name: 'SpacesHomeControlPluginUpdateActivityMode' })
export class UpdateActivityModeDto {
	@ApiProperty({ description: 'Expected configuration revision (compare-and-swap)', type: 'integer', minimum: 1 })
	@Expose()
	@IsInt()
	@Min(1)
	expected_revision: number;
	@ApiProperty({ description: 'Whether the mode is available for activation', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;
	@ApiProperty({ description: 'Per-space display order', type: 'integer', minimum: 0, maximum: 1000 })
	@Expose()
	@IsInt()
	@Min(0)
	@Max(1000)
	display_order: number;
	@ApiProperty({ description: 'Full replacement configuration', type: () => ActivityConfigurationModel })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityConfigurationModel)
	configuration: ActivityConfigurationModel;
}
@ApiSchema({ name: 'SpacesHomeControlPluginActivityRevision' })
export class ActivityRevisionDto {
	@ApiProperty({ description: 'Expected configuration revision', type: 'integer', minimum: 1 })
	@Expose()
	@IsInt()
	@Min(1)
	expected_revision: number;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDeactivateActivity' })
export class DeactivateActivityDto {
	@ApiProperty({ description: 'Activation identity to clear; rejects stale clients', type: 'string', format: 'uuid' })
	@Expose()
	@IsUUID('4')
	activation_id: string;
}

@ApiSchema({ name: 'SpacesHomeControlPluginReqUpdateActivityMode' })
export class ReqUpdateActivityModeDto {
	@ApiProperty({ description: 'Request data', type: () => UpdateActivityModeDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateActivityModeDto)
	data: UpdateActivityModeDto;
}

@ApiSchema({ name: 'SpacesHomeControlPluginReqActivityRevision' })
export class ReqActivityRevisionDto {
	@ApiProperty({ description: 'Request data', type: () => ActivityRevisionDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityRevisionDto)
	data: ActivityRevisionDto;
}

@ApiSchema({ name: 'SpacesHomeControlPluginReqDeactivateActivity' })
export class ReqDeactivateActivityDto {
	@ApiProperty({ description: 'Request data', type: () => DeactivateActivityDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => DeactivateActivityDto)
	data: DeactivateActivityDto;
}
