import { EntityManager } from 'typeorm';

import { ConflictException } from '@nestjs/common';

import { captureSqliteNoMutationWindow } from '../../../common/database/sqlite-data-source';

import { OccupancyActivityAdmission } from './space-occupancy.types';

/** Capture before any writes; final validation closes DML through the original native COMMIT. */
export function prepareOccupancyValidation(
	admission: OccupancyActivityAdmission,
	activationId: string,
	spaceId: string,
	configuration?: { id: string; revision: number },
) {
	const current = admission.isCurrent;
	return (manager: EntityManager) => {
		const window = captureSqliteNoMutationWindow(manager, () => Reflect.apply(current, admission, []));
		return async () => {
			window.beginFinalValidation();
			const rows = await manager.query<unknown[]>(
				`SELECT o.id FROM spaces_home_control_occupancy o
				JOIN spaces_module_spaces p ON p.id = o.spaceId
				JOIN spaces_module_space_roles a ON a.spaceId = o.spaceId AND a.type = 'activity_state'
				${configuration ? "JOIN spaces_module_space_roles c ON c.spaceId = o.spaceId AND c.type = 'activity_config'" : ''}
				WHERE o.id = ? AND o.spaceId = ? AND o.revision = ? AND o.enabled = 1
				AND o.manualOverride = 0 AND o.status = ? AND o.transitionId = ?
				AND o.actedTransitionId = ? AND o.lastAutomaticActivationId = ?
				AND a.activationId = ? AND p.type IN ('room','zone')
				${configuration ? 'AND c.id = ? AND c.activityRevision = ? AND c.activityEnabled = 1' : ''}`,
				[
					admission.occupancyId,
					spaceId,
					admission.revision,
					admission.status,
					admission.transitionId,
					admission.transitionId,
					activationId,
					activationId,
					...(configuration ? [configuration.id, configuration.revision] : []),
				],
			);
			if (rows.length !== 1) throw new ConflictException('Occupancy admission changed before COMMIT');
			window.applied();
		};
	};
}

export async function claimOccupancy(
	manager: EntityManager,
	admission: OccupancyActivityAdmission,
	activationId: string,
): Promise<void> {
	if (!admission.isCurrent()) throw new ConflictException('Occupancy observation expired');
	const result = await manager.query<{ changes?: number }>(
		`UPDATE spaces_home_control_occupancy SET actedTransitionId = ?, lastAutomaticActivationId = ?, lastAttemptStatus = 'started'
		WHERE id = ? AND revision = ? AND enabled = 1 AND manualOverride = 0 AND status = ? AND transitionId = ?
		AND actedTransitionId IS NOT ?`,
		[
			admission.transitionId,
			activationId,
			admission.occupancyId,
			admission.revision,
			admission.status,
			admission.transitionId,
			admission.transitionId,
		],
	);
	// SELECT the exact image instead of relying on driver-specific UPDATE return shapes.
	void result;
	const rows = await manager.query<unknown[]>(
		'SELECT id FROM spaces_home_control_occupancy WHERE id = ? AND actedTransitionId = ? AND lastAutomaticActivationId = ?',
		[admission.occupancyId, admission.transitionId, activationId],
	);
	if (rows.length !== 1) throw new ConflictException('Occupancy transition has already been consumed or changed');
}
