import { ActivityMode } from '../activity/space-activity.constants';

export const SPACE_SCHEDULE_CHANGED = 'SpacesModule.ActivitySchedule.Changed';
export const SPACE_SCHEDULE_TABLE = 'spaces_home_control_mode_schedules';
export const MAX_SPACE_SCHEDULE_ENTRIES = 64;

export interface ScheduleEntry {
	id: string;
	mode: ActivityMode;
	time: string;
	days_of_week: number[];
	enabled: boolean;
}

export interface ScheduleOccurrence {
	entry_id: string;
	mode: ActivityMode;
	time: string;
	local_date: string;
	timezone: string;
	occurs_at: string;
}

/** Internal, server-created admission. Public activity endpoints never accept this object. */
export interface ScheduledActivityAdmission {
	readonly scheduleId: string;
	readonly revision: number;
	readonly occurrenceId: string;
	readonly occursAt: number;
	readonly previousActivationId: string | null;
	readonly isCurrent: () => boolean;
}

export type ScheduleAttemptStatus = 'claimed' | 'started' | 'failed' | 'conflict' | 'interrupted';
