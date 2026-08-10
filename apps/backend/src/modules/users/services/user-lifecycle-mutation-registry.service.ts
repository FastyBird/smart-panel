import { EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { UserEntity } from '../entities/users.entity';

export type UserLifecycleCommit<T> = (manager?: EntityManager) => Promise<T>;

export interface UserLifecycleMutationHandler {
	update: <T>(previous: UserEntity, next: UserEntity, commit: UserLifecycleCommit<T>) => Promise<T>;
	remove: <T>(user: UserEntity, commit: UserLifecycleCommit<T>) => Promise<T>;
}

@Injectable()
export class UserLifecycleMutationRegistryService {
	private handler: UserLifecycleMutationHandler | null = null;

	register(handler: UserLifecycleMutationHandler): void {
		if (this.handler) throw new Error('A user lifecycle mutation handler is already registered');

		this.handler = handler;
	}

	async update<T>(previous: UserEntity, next: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		return this.handler ? this.handler.update(previous, next, commit) : commit();
	}

	async remove<T>(user: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		return this.handler ? this.handler.remove(user, commit) : commit();
	}
}
