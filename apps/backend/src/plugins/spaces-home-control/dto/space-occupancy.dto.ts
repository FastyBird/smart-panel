import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ActivityMode } from '../activity/space-activity.constants';

@ApiSchema({ name: 'SpacesHomeControlPluginUpdateOccupancy' })
export class UpdateSpaceOccupancyDto {
	@ApiProperty({ name: 'expected_revision', type: 'integer', minimum: 1 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;

	@ApiProperty({ type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({ name: 'vacancy_timeout_seconds', type: 'integer', minimum: 30, maximum: 86400 })
	@Expose({ name: 'vacancy_timeout_seconds' })
	@IsInt()
	@Min(30)
	@Max(86400)
	vacancyTimeoutSeconds: number;

	@ApiProperty({ name: 'maximum_age_seconds', type: 'integer', minimum: 30, maximum: 86400 })
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(30)
	@Max(86400)
	maximumAgeSeconds: number;

	@ApiProperty({ name: 'sensor_property_ids', type: [String], maxItems: 32 })
	@Expose({ name: 'sensor_property_ids' })
	@IsArray()
	@ArrayMaxSize(32)
	@ArrayUnique()
	@IsUUID('4', { each: true })
	sensorPropertyIds: string[];

	@ApiProperty({
		name: 'occupied_mode',
		anyOf: [{ type: 'string', enum: Object.values(ActivityMode) }, { type: 'null' }],
	})
	@Expose({ name: 'occupied_mode' })
	@IsOptional()
	@IsEnum(ActivityMode)
	occupiedMode: ActivityMode | null = null;

	@ApiProperty({
		name: 'vacant_mode',
		anyOf: [{ type: 'string', enum: Object.values(ActivityMode) }, { type: 'null' }],
	})
	@Expose({ name: 'vacant_mode' })
	@IsOptional()
	@IsEnum(ActivityMode)
	vacantMode: ActivityMode | null = null;
}

@ApiSchema({ name: 'SpacesHomeControlPluginReqUpdateOccupancy' })
export class ReqUpdateSpaceOccupancyDto {
	@ApiProperty({ type: () => UpdateSpaceOccupancyDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateSpaceOccupancyDto)
	data: UpdateSpaceOccupancyDto;
}
