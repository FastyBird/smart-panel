import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ActivityMode } from '../activity/space-activity.constants';
import { MAX_SPACE_SCHEDULE_ENTRIES, ScheduleEntry } from '../schedule/space-mode-schedule.types';

@ApiSchema({ name: 'SpacesHomeControlPluginScheduleEntry' })
export class ScheduleEntryDto implements ScheduleEntry {
	@ApiProperty({ description: 'Stable entry UUID, retained when editing', type: 'string', format: 'uuid' })
	@Expose()
	@IsUUID('4')
	id: string;
	@ApiProperty({ description: 'Explicit configured activity mode', enum: ActivityMode })
	@Expose()
	@IsEnum(ActivityMode)
	mode: ActivityMode;
	@ApiProperty({ description: 'Local HH:MM wall time', type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
	@Expose()
	@IsString()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
	time: string;
	@ApiProperty({
		description: 'Sunday=0 through Saturday=6; daily or selected weekdays',
		type: 'integer',
		isArray: true,
		minItems: 1,
		maxItems: 7,
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(7)
	@ArrayUnique()
	@IsInt({ each: true })
	@Min(0, { each: true })
	@Max(6, { each: true })
	days_of_week: number[];
	@ApiProperty({ description: 'Whether this entry participates', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;
}

@ApiSchema({ name: 'SpacesHomeControlPluginUpdateSchedule' })
export class UpdateSpaceModeScheduleDto {
	@ApiProperty({ description: 'Expected configuration revision', type: 'integer', minimum: 1 })
	@Expose()
	@IsInt()
	@Min(1)
	@Max(Number.MAX_SAFE_INTEGER - 1)
	expected_revision: number;
	@ApiProperty({ description: 'Per-space scheduling opt-in', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;
	@ApiProperty({
		description: 'IANA timezone override; null follows the house timezone',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@IsString()
	@MaxLength(100)
	timezone: string | null;
	@ApiProperty({
		description: 'Complete weekly entry replacement',
		type: () => ScheduleEntryDto,
		isArray: true,
		maxItems: MAX_SPACE_SCHEDULE_ENTRIES,
	})
	@Expose()
	@IsArray()
	@ArrayMaxSize(MAX_SPACE_SCHEDULE_ENTRIES)
	@ValidateNested({ each: true })
	@Type(() => ScheduleEntryDto)
	entries: ScheduleEntryDto[];
}

@ApiSchema({ name: 'SpacesHomeControlPluginReqUpdateSchedule' })
export class ReqUpdateSpaceModeScheduleDto {
	@ApiProperty({ description: 'Request data', type: () => UpdateSpaceModeScheduleDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateSpaceModeScheduleDto)
	data: UpdateSpaceModeScheduleDto;
}
