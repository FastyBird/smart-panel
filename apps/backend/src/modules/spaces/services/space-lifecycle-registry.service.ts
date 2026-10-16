import { EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { SpaceEntity } from '../entities/space.entity';

export interface SpaceLifecycleHook {
	reconcile(space: SpaceEntity, manager: EntityManager): Promise<void>;
}
/** Plugins initialize or remove owned rows atomically with generic space create/type changes. */
@Injectable()
export class SpaceLifecycleRegistryService {
	private readonly hooks: SpaceLifecycleHook[] = [];
	register(hook: SpaceLifecycleHook): void {
		this.hooks.push(hook);
	}
	async reconcile(space: SpaceEntity, manager: EntityManager): Promise<void> {
		for (const hook of this.hooks) await hook.reconcile(space, manager);
	}
}
