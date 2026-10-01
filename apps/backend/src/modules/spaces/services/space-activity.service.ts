import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { SpaceEntity } from '../entities/space.entity';

/**
 * Derived activity belongs to the running process, not to the structural SQLite catalog.
 * After a restart, the legacy persisted timestamp remains the fallback until a newer report arrives.
 * This is deliberately not durable history or shared state between backend processes.
 */
@Injectable()
export class SpaceActivityService implements OnModuleDestroy {
	private readonly activity = new Map<string, number>();

	record(spaceId: string, observedAt: Date): void {
		const timestamp = observedAt.getTime();
		if (!Number.isFinite(timestamp)) return;
		this.activity.set(spaceId, Math.max(timestamp, this.activity.get(spaceId) ?? timestamp));
	}

	readLatest(space: Pick<SpaceEntity, 'id' | 'lastActivityAt'>): Date | string | null {
		const recorded = this.activity.get(space.id);
		if (recorded === undefined) return space.lastActivityAt;

		const persisted =
			space.lastActivityAt instanceof Date ? space.lastActivityAt.getTime() : Date.parse(space.lastActivityAt ?? '');
		return new Date(Number.isFinite(persisted) ? Math.max(recorded, persisted) : recorded);
	}

	delete(spaceId: string): void {
		this.activity.delete(spaceId);
	}

	clear(): void {
		this.activity.clear();
	}

	onModuleDestroy(): void {
		this.clear();
	}
}
