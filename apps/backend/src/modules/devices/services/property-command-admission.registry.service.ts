import { Injectable } from '@nestjs/common';

import { IDevicePropertyData } from '../platforms/device.platform';

export interface PropertyCommandAdmissionGuard {
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
	async assertAllowed(update: IDevicePropertyData): Promise<void> {
		for (const guard of this.guards) await guard.assertAllowed(update);
	}
}
