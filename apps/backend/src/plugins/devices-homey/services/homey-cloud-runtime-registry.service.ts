import { Injectable } from '@nestjs/common';

export type HomeyCloudRuntimeTeardownGuard = () => Promise<boolean>;

export type HomeyCloudRuntimeTeardown = (shouldDisconnect: HomeyCloudRuntimeTeardownGuard) => Promise<void>;

@Injectable()
export class HomeyCloudRuntimeRegistryService {
	private teardown: HomeyCloudRuntimeTeardown | null = null;

	register(teardown: HomeyCloudRuntimeTeardown): void {
		if (this.teardown !== null) throw new Error('A Homey Cloud runtime teardown handler is already registered');

		this.teardown = teardown;
	}

	disconnectGrant(shouldDisconnect: HomeyCloudRuntimeTeardownGuard): Promise<void> {
		if (this.teardown === null) return Promise.reject(new Error('Homey Cloud runtime teardown is not registered'));

		return this.teardown(shouldDisconnect);
	}
}
