import { DataSource, EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { UserEntity } from '../entities/users.entity';

export type UserLifecycleCommit<T> = (manager?: EntityManager) => Promise<T>;

export interface UserLifecycleMutationHandler {
	update: <T>(previous: UserEntity, next: UserEntity, commit: UserLifecycleCommit<T>) => Promise<T>;
	remove: <T>(user: UserEntity, commit: UserLifecycleCommit<T>) => Promise<T>;
}

export interface UserLifecycleMutationParticipant {
	prepareUpdate: (previous: UserEntity, next: UserEntity, manager: EntityManager) => Promise<void>;
	prepareRemove: (user: UserEntity, manager: EntityManager) => Promise<void>;
}

@Injectable()
export class UserLifecycleMutationRegistryService {
	private handler: UserLifecycleMutationHandler | null = null;
	private readonly participants = new Set<UserLifecycleMutationParticipant>();

	constructor(private readonly dataSource: DataSource) {}

	register(handler: UserLifecycleMutationHandler): void {
		if (this.handler) throw new Error('A user lifecycle mutation handler is already registered');

		this.handler = handler;
	}

	registerParticipant(participant: UserLifecycleMutationParticipant): void {
		if (this.participants.has(participant))
			throw new Error('User lifecycle mutation participant is already registered');

		this.participants.add(participant);
	}

	async update<T>(previous: UserEntity, next: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		if (this.participants.size === 0) return this.handler ? this.handler.update(previous, next, commit) : commit();

		const guardedCommit: UserLifecycleCommit<T> = (manager) =>
			this.runParticipants(
				manager,
				(transactionManager) => this.prepareUpdate(previous, next, transactionManager),
				commit,
			);

		return this.handler ? this.handler.update(previous, next, guardedCommit) : guardedCommit();
	}

	async remove<T>(user: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		if (this.participants.size === 0) return this.handler ? this.handler.remove(user, commit) : commit();

		const guardedCommit: UserLifecycleCommit<T> = (manager) =>
			this.runParticipants(manager, (transactionManager) => this.prepareRemove(user, transactionManager), commit);

		return this.handler ? this.handler.remove(user, guardedCommit) : guardedCommit();
	}

	private async runParticipants<T>(
		manager: EntityManager | undefined,
		prepare: (manager: EntityManager) => Promise<void>,
		commit: UserLifecycleCommit<T>,
	): Promise<T> {
		if (manager) {
			await prepare(manager);
			return commit(manager);
		}

		return this.dataSource.transaction(async (transactionManager) => {
			await prepare(transactionManager);
			return commit(transactionManager);
		});
	}

	private async prepareUpdate(previous: UserEntity, next: UserEntity, manager: EntityManager): Promise<void> {
		for (const participant of this.participants) await participant.prepareUpdate(previous, next, manager);
	}

	private async prepareRemove(user: UserEntity, manager: EntityManager): Promise<void> {
		for (const participant of this.participants) await participant.prepareRemove(user, manager);
	}
}
