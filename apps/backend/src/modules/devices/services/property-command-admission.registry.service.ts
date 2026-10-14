import { Injectable } from '@nestjs/common';

import { IDevicePropertyData } from '../platforms/device.platform';

export interface PropertyCommandAdmissionSnapshot {
	isCurrent(): boolean;
	assertAllowed(update: IDevicePropertyData): Promise<void>;
}

export interface PropertyCommandAdmissionGuard {
	capture?(): PropertyCommandAdmissionSnapshot;
	requiresGuardedDispatch?(update: IDevicePropertyData): boolean;
	/** Internal policy hook: ordinary user/group/scene commands all consult the same canonical leaf. */
	assertAllowed(update: IDevicePropertyData): Promise<void>;
}

/** Controller ownership can register here without core depending on a virtual-device plugin. */
@Injectable()
export class PropertyCommandAdmissionRegistryService {
	private readonly guards = new Set<PropertyCommandAdmissionGuard>();
	register(guard: PropertyCommandAdmissionGuard): () => void {
		this.guards.add(guard);
		return () => this.guards.delete(guard);
	}
	hasGuards(): boolean {
		return this.guards.size > 0;
	}
	requiresGuardedDispatch(update: IDevicePropertyData): boolean {
		return [...this.guards].some((guard) => guard.requiresGuardedDispatch?.(update));
	}
	capture(): PropertyCommandAdmissionSnapshot {
		const guards = [...this.guards];
		const snapshots = guards.map((guard) => guard.capture?.());
		return {
			isCurrent: () =>
				guards.length === this.guards.size &&
				guards.every((guard) => this.guards.has(guard)) &&
				snapshots.every((snapshot) => snapshot?.isCurrent() ?? true),
			assertAllowed: async (update) => {
				for (const [index, guard] of guards.entries()) await (snapshots[index] ?? guard).assertAllowed(update);
			},
		};
	}
	async assertAllowed(update: IDevicePropertyData): Promise<void> {
		for (const guard of this.guards) await guard.assertAllowed(update);
	}
}
