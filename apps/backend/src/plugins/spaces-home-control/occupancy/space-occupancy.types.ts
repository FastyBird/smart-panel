import { ActivityMode } from '../activity/space-activity.constants';

export const SPACE_OCCUPANCY_TABLE = 'spaces_home_control_occupancy';
export const SPACE_OCCUPANCY_CHANGED = 'SpacesModule.Occupancy.Changed';
export const SPACE_OCCUPANCY_MONOTONIC_CLOCK = Symbol('SpaceOccupancyMonotonicClock');
export enum OccupancyStatus {
	UNKNOWN = 'unknown',
	OCCUPIED = 'occupied',
	VACANT = 'vacant',
}

/** Private admission, created only by the managed occupancy runtime. */
export interface OccupancyActivityAdmission {
	readonly occupancyId: string;
	readonly revision: number;
	readonly transitionId: string;
	readonly status: OccupancyStatus;
	readonly previousActivationId: string | null;
	readonly isCurrent: () => boolean;
}

export interface OccupancyObservation {
	readonly status: OccupancyStatus;
	readonly isCurrent: () => boolean;
}

export interface OccupancyMemory {
	status: OccupancyStatus;
	negativeSince: number | null;
	wall: number;
}

/** No clock jump or evidence gap can count as elapsed vacancy time. */
export function advanceOccupancy(
	prior: OccupancyMemory,
	input: OccupancyStatus,
	wall: number,
	monotonic: number,
	timeout: number,
): OccupancyMemory {
	if (!Number.isFinite(wall) || !Number.isFinite(monotonic) || wall < prior.wall)
		return { status: OccupancyStatus.UNKNOWN, negativeSince: null, wall };
	if (input !== OccupancyStatus.VACANT) return { status: input, negativeSince: null, wall };
	const since = prior.negativeSince === null || monotonic < prior.negativeSince ? monotonic : prior.negativeSince;
	return {
		status:
			monotonic - since >= timeout
				? OccupancyStatus.VACANT
				: prior.status === OccupancyStatus.OCCUPIED
					? OccupancyStatus.OCCUPIED
					: OccupancyStatus.UNKNOWN,
		negativeSince: since,
		wall,
	};
}

export interface OccupancySelection {
	occupiedMode: ActivityMode | null;
	vacantMode: ActivityMode | null;
}
