import { Injectable } from '@nestjs/common';

import { IDevicePropertyData } from '../platforms/device.platform';

/** A physical side effect reservation check, never a sibling write or guessed numeric target. */
export interface PropertyCommandEffect extends Pick<IDevicePropertyData, 'device' | 'channel' | 'property'> {
	readonly kind: 'cover_action';
	readonly action: 'open' | 'close' | 'stop';
}

export interface PropertyCommandAdmissionSnapshot {
	/** Checks captured ownership for one leaf, or all guard state when no leaf is supplied. */
	isCurrent(update?: IDevicePropertyData): boolean;
	isEffectCurrent?(effect: PropertyCommandEffect): boolean;
	assertEffectAllowed?(effect: PropertyCommandEffect): Promise<void>;
	/** Checks request-wide fences before canonical leaves are known. */
	isRequestCurrent?(): boolean;
	assertAllowed(update: IDevicePropertyData): Promise<void>;
}

export interface PropertyCommandAdmissionGuard {
	capture?(): PropertyCommandAdmissionSnapshot;
	isEffectCurrent?(effect: PropertyCommandEffect): boolean;
	assertEffectAllowed?(effect: PropertyCommandEffect): Promise<void>;
	requiresGuardedDispatch?(update: IDevicePropertyData): boolean;
	/** Internal policy hook: ordinary user/group/scene commands all consult the same canonical leaf. */
	assertAllowed(update: IDevicePropertyData): Promise<void>;
}

/** Controller ownership can register here without core depending on a virtual-device plugin. */
@Injectable()
export class PropertyCommandAdmissionRegistryService {
	private readonly guards = new Set<PropertyCommandAdmissionGuard>();
	private revision = 0;
	/** Registers a policy guard and invalidates captures whenever membership changes. */
	register(guard: PropertyCommandAdmissionGuard): () => void {
		if (!this.guards.has(guard)) this.revision++;
		this.guards.add(guard);
		return () => {
			if (this.guards.delete(guard)) this.revision++;
		};
	}
	hasGuards(): boolean {
		return this.guards.size > 0;
	}
	requiresGuardedDispatch(update: IDevicePropertyData): boolean {
		return [...this.guards].some((guard) => guard.requiresGuardedDispatch?.(update));
	}
	/** Captures guard membership and per-leaf policy before asynchronous preparation. */
	capture(): PropertyCommandAdmissionSnapshot {
		const guards = [...this.guards];
		const snapshots = guards.map((guard) => guard.capture?.());
		const revision = this.revision;
		const hasCurrentMembership = () => revision === this.revision;
		const effectsCurrent = (effect: PropertyCommandEffect) =>
			hasCurrentMembership() &&
			guards.every((guard, index) => (snapshots[index] ?? guard).isEffectCurrent?.(effect) === true);

		return {
			isEffectCurrent: effectsCurrent,
			assertEffectAllowed: async (effect) => {
				if (!effectsCurrent(effect)) throw new Error('Cover effect admission changed or is unsupported');
				for (const [index, guard] of guards.entries()) {
					const policy = snapshots[index] ?? guard;
					if (!policy.assertEffectAllowed) throw new Error('Guard does not support cover effect admission');
					await policy.assertEffectAllowed(effect);
				}
			},
			isCurrent: (update) =>
				hasCurrentMembership() && snapshots.every((snapshot) => snapshot?.isCurrent(update) ?? true),
			isRequestCurrent: () =>
				hasCurrentMembership() &&
				snapshots.every((snapshot) => snapshot?.isRequestCurrent?.() ?? snapshot?.isCurrent() ?? true),
			assertAllowed: async (update) => {
				if (!hasCurrentMembership()) throw new Error('Command admission guard membership changed');
				for (const [index, guard] of guards.entries()) await (snapshots[index] ?? guard).assertAllowed(update);
			},
		};
	}
	async assertAllowed(update: IDevicePropertyData): Promise<void> {
		for (const guard of this.guards) await guard.assertAllowed(update);
	}
}
