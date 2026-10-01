import {
	DataSource,
	EntitySubscriberInterface,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	TransactionStartEvent,
} from 'typeorm';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { SpaceEntity } from '../entities/space.entity';
import { SpaceActivityService } from '../services/space-activity.service';

@Injectable()
export class SpaceActivitySubscriber implements EntitySubscriberInterface<SpaceEntity>, OnModuleDestroy {
	private readonly pendingRemovals = new WeakMap<object, Array<Set<string> | null>>();

	constructor(
		private readonly activity: SpaceActivityService,
		private readonly dataSource: DataSource,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof SpaceEntity {
		return SpaceEntity;
	}

	afterLoad(space: SpaceEntity): void {
		space.lastActivityAt = this.activity.readLatest(space);
	}

	afterTransactionStart(event: TransactionStartEvent): void {
		const levels = this.pendingRemovals.get(event.queryRunner) ?? [];
		levels.push(new Set());
		this.pendingRemovals.set(event.queryRunner, levels);
	}

	afterRemove(event: RemoveEvent<SpaceEntity>): void {
		const id = typeof event.entityId === 'string' ? event.entityId : (event.entity?.id ?? event.databaseEntity?.id);
		if (event.queryRunner.isTransactionActive) {
			const levels = this.pendingRemovals.get(event.queryRunner) ?? [new Set<string>()];
			const pending = levels.at(-1);
			if (pending === null) return;
			if (id) pending.add(id);
			else levels[levels.length - 1] = null;
			this.pendingRemovals.set(event.queryRunner, levels);
			return;
		}
		if (id) this.activity.delete(id);
		else this.activity.clear();
	}

	afterTransactionCommit(event: TransactionCommitEvent): void {
		const levels = this.pendingRemovals.get(event.queryRunner);
		const pending = levels?.pop();
		if (levels?.length) {
			// A savepoint commit is not durable until its outer transaction commits.
			const parent = levels.at(-1);
			if (pending === null) levels[levels.length - 1] = null;
			else pending?.forEach((id) => parent?.add(id));
			return;
		}
		this.pendingRemovals.delete(event.queryRunner);
		if (pending === null) this.activity.clear();
		else pending?.forEach((id) => this.activity.delete(id));
	}

	afterTransactionRollback(event: TransactionRollbackEvent): void {
		const levels = this.pendingRemovals.get(event.queryRunner);
		levels?.pop();
		if (!levels?.length) this.pendingRemovals.delete(event.queryRunner);
	}

	onModuleDestroy(): void {
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
	}
}
