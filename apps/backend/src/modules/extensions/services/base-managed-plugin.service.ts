import { IManagedPluginService, ServiceState } from './managed-plugin-service.interface';

/**
 * Abstract base class for managed plugin services.
 *
 * Provides the common lifecycle utilities shared by all IManagedPluginService
 * implementations: state tracking, a serialization lock for start/stop, and
 * a state-polling helper.
 *
 * Subclasses implement the abstract `pluginName`, `serviceId`, `start()`,
 * and `stop()` members. They use `withLock()` inside start/stop to ensure
 * at most one lifecycle operation runs at a time.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyManagedService extends BaseManagedPluginService {
 *   readonly pluginName = 'my-plugin';
 *   readonly serviceId = 'connector';
 *
 *   async start(): Promise<void> {
 *     await this.withLock(async () => {
 *       if (this.state === 'started') return;
 *       this.state = 'starting';
 *       // ... init logic ...
 *       this.state = 'started';
 *     });
 *   }
 *
 *   async stop(): Promise<void> {
 *     await this.withLock(async () => {
 *       if (this.state === 'stopped') return;
 *       this.state = 'stopping';
 *       // ... cleanup logic ...
 *       this.state = 'stopped';
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseManagedPluginService implements IManagedPluginService {
	abstract readonly pluginName: string;
	abstract readonly serviceId: string;

	protected state: ServiceState = 'stopped';

	/**
	 * Promise chain that serializes start/stop operations.
	 * Each `withLock()` call awaits the previous one before running.
	 */
	private startStopLock: Promise<void> = Promise.resolve();

	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;

	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Serialize an async operation so that concurrent start/stop calls
	 * execute one at a time. Because each call awaits the previous lock,
	 * the state is guaranteed to be in a terminal state (`started`,
	 * `stopped`, or `error`) when `fn` begins — never in a transitional
	 * state (`starting`, `stopping`).
	 */
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
