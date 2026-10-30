import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ActivityMode } from '../activity/space-activity.constants';
import { ScheduleEntry, ScheduleOccurrence } from '../schedule/space-mode-schedule.types';

@ApiSchema({ name: 'SpacesHomeControlPluginDataScheduleEntry' })
export class ScheduleEntryModel implements ScheduleEntry {
	@ApiProperty({ description: 'Stable entry identity', type: 'string', format: 'uuid' })
	@Expose()
	id: string;
	@ApiProperty({ description: 'Explicit activity mode, not a thermostat preset', enum: ActivityMode })
	@Expose()
	mode: ActivityMode;
	@ApiProperty({
		description: 'Local wall time in HH:MM format',
		type: 'string',
		pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
	})
	@Expose()
	time: string;
	@ApiProperty({ description: 'Sunday=0 through Saturday=6', type: 'integer', isArray: true, minItems: 1, maxItems: 7 })
	@Expose()
	days_of_week: number[];
	@ApiProperty({ description: 'Whether this entry participates', type: 'boolean' })
	@Expose()
	enabled: boolean;
}

@ApiSchema({ name: 'SpacesHomeControlPluginDataScheduleOccurrence' })
export class ScheduleOccurrenceModel implements ScheduleOccurrence {
	@ApiProperty({ description: 'Entry identity', type: 'string', format: 'uuid' })
	@Expose()
	entry_id: string;
	@ApiProperty({ description: 'Scheduled activity mode', enum: ActivityMode })
	@Expose()
	mode: ActivityMode;
	@ApiProperty({ description: 'Authored HH:MM wall time', type: 'string' })
	@Expose()
	time: string;
	@ApiProperty({ description: 'Local calendar date', type: 'string', format: 'date' })
	@Expose()
	local_date: string;
	@ApiProperty({ description: 'Resolved IANA timezone', type: 'string' })
	@Expose()
	timezone: string;
	@ApiProperty({
		description: 'First real UTC instant; missing DST times are omitted',
		type: 'string',
		format: 'date-time',
	})
	@Expose()
	occurs_at: string;
}

export enum ScheduleRuntimeStatus {
	RUNNING = 'running',
	STOPPED = 'stopped',
	CLOCK_UNCERTAIN = 'clock_uncertain',
	UNAVAILABLE = 'unavailable',
}

@ApiSchema({ name: 'SpacesHomeControlPluginDataScheduleState' })
export class SpaceModeScheduleStateModel {
	@ApiProperty({ description: 'Space identity', type: 'string', format: 'uuid' })
	@Expose()
	space_id: string;
	@ApiProperty({ description: 'Per-space scheduling enabled', type: 'boolean' })
	@Expose()
	enabled: boolean;
	@ApiProperty({ description: 'Resolved house or per-space timezone', type: 'string', nullable: true })
	@Expose()
	timezone: string | null;
	@ApiProperty({
		description: 'Scheduler availability, distinct from actual device state',
		enum: ScheduleRuntimeStatus,
	})
	@Expose()
	status: ScheduleRuntimeStatus;
	@ApiProperty({
		description: 'Most recent planned occurrence; not proof it executed',
		type: () => ScheduleOccurrenceModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ScheduleOccurrenceModel)
	current: ScheduleOccurrenceModel | null;
	@ApiProperty({ description: 'Next future occurrence', type: () => ScheduleOccurrenceModel, nullable: true })
	@Expose()
	@Type(() => ScheduleOccurrenceModel)
	next: ScheduleOccurrenceModel | null;
	@ApiProperty({
		description: 'A manual activity selection or clear takes precedence until the next trigger',
		type: 'boolean',
	})
	@Expose()
	manual_override: boolean;
	@ApiProperty({
		description: 'Last attempted occurrence, without replay on restart',
		type: () => ScheduleOccurrenceModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ScheduleOccurrenceModel)
	last_attempt: ScheduleOccurrenceModel | null;
	@ApiProperty({
		description: 'Last scheduler admission outcome; not actuator confirmation',
		enum: ['claimed', 'started', 'failed', 'conflict', 'interrupted'],
		nullable: true,
	})
	@Expose()
	last_attempt_status: string | null;
}
