import { DataSource, EntityManager } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';

import { observeSqliteOuterOutcome, registerSqliteCommitGuard } from '../../../common/database/sqlite-data-source';
import { ClimateAutomationLedgerService } from '../../devices/services/climate-automation-ledger.service';
import { captureCreation, invokeCreation } from '../../devices/services/creation-capture';
import { DeviceStructureLockService } from '../../devices/services/device-structure-lock.service';
import { SpaceEntity } from '../entities/space.entity';

export interface SpaceLifecycleHook {
	reconcile(space: SpaceEntity, manager: EntityManager): Promise<void>;
	beforeAdmission?(id: string, kind: 'delete' | 'type-change'): Promise<void | (() => void)>;
	beforeMutation?(id: string, kind: 'delete' | 'type-change', manager: EntityManager): Promise<void>;
}
/** Plugins initialize or remove owned rows atomically with generic space create/type changes. */
@Injectable()
export class SpaceLifecycleRegistryService {
	private readonly hooks = new Map<SpaceLifecycleHook, object>();
	constructor(
		@Optional() private readonly structure?: DeviceStructureLockService,
		@Optional() private readonly ledger?: ClimateAutomationLedgerService,
	) {}
	register(hook: SpaceLifecycleHook): () => void {
		if (this.hooks.has(hook)) throw new Error('Space lifecycle hook already registered');
		const registration = {};
		this.hooks.set(hook, registration);
		return () => {
			if (this.hooks.get(hook) === registration) this.hooks.delete(hook);
		};
	}
	async reconcile(space: SpaceEntity, manager: EntityManager): Promise<void> {
		for (const hook of this.hooks.keys()) await hook.reconcile(space, manager);
	}

	/** Own structure BEFORE SQLite, and retire exact plugin state before the first space mutation. */
	mutate<T>(
		database: DataSource,
		id: string,
		kind: 'delete' | 'type-change',
		work: (manager: EntityManager, instrumented: boolean) => Promise<T>,
	): Promise<T> {
		const participants = [...this.hooks]
			.map(([hook, registration]) => ({
				hook,
				registration,
				capture: captureCreation(hook, ['beforeMutation', 'beforeAdmission']),
			}))
			.filter(({ capture }) => capture.values.beforeMutation !== undefined);
		if (!participants.length) return database.transaction((manager) => work(manager, false));
		if (!this.structure || !this.ledger) throw new Error('Space climate lifecycle owner unavailable');
		const current = () =>
			participants.every(
				({ hook, registration, capture }) => this.hooks.get(hook) === registration && capture.current(),
			);
		const releases: (() => void)[] = [];
		const admit = async () => {
			for (const { hook, capture } of participants) {
				const release = await (capture.values.beforeAdmission == null
					? undefined
					: invokeCreation(capture.values.beforeAdmission, hook, id, kind));
				if (release) releases.push(release);
			}
			if (!current()) throw new Error('Original space lifecycle participant expired');
		};
		return admit()
			.then(() =>
				this.structure.runExclusive(async () => {
					const ownerCurrent = this.structure.captureExclusiveOwner();
					return database.transaction(async (manager) => {
						const receipt = observeSqliteOuterOutcome(manager);
						registerSqliteCommitGuard(manager, () => ownerCurrent() && current());
						await manager.query('UPDATE "spaces_module_spaces" SET "id"="id" WHERE 0');
						return this.ledger.inAdmittedManager(manager, receipt, async () => {
							if (!current()) throw new Error('Original space lifecycle participant expired');
							for (const { hook, capture } of participants)
								await invokeCreation(capture.values.beforeMutation, hook, id, kind, manager);
							return work(manager, true);
						});
					});
				}),
			)
			.finally(() => {
				for (const release of releases.reverse()) release();
			});
	}
}
