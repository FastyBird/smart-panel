import { IManagedExtensionService, ManagedServiceOwner, ServiceState } from './managed-extension-service.interface';

/**
 * Common lifecycle utilities for managed extension services.
 */
export abstract class BaseManagedExtensionService implements IManagedExtensionService {
	abstract readonly owner: ManagedServiceOwner;
	abstract readonly serviceId: string;

	protected state: ServiceState = 'stopped';

	private startStopLock: Promise<void> = Promise.resolve();

	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;

	getState(): ServiceState {
		return this.state;
	}

	protected async withLock<T>(fn: () => Promise<T>): Promise<T> {
		const previousLock = this.startStopLock;
		let releaseLock: () => void = () => {};

		this.startStopLock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		try {
			await previousLock;

			return await fn();
		} finally {
			releaseLock();
		}
	}
}
