import { WeeklyScheduleEntry, WeeklyScheduleOccurrence } from '../../../common/schedule/schedule-time';
import { ActivityMode } from '../activity/space-activity.constants';

export const SPACE_SCHEDULE_CHANGED = 'SpacesModule.ActivitySchedule.Changed';
export const SPACE_SCHEDULE_TABLE = 'spaces_home_control_mode_schedules';
export const MAX_SPACE_SCHEDULE_ENTRIES = 64;

export type ScheduleEntry = WeeklyScheduleEntry<ActivityMode>;

export type ScheduleOccurrence = WeeklyScheduleOccurrence<ActivityMode>;

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
