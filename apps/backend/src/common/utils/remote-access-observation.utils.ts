/** A bounded, provider-local read. The slot remains occupied until cancelled work has actually settled. */
export class RemoteAccessObservation<T> {
	private active: { abort: AbortController; result: Promise<T>; settled: Promise<void> } | null = null;
	private readonly idleWaiters = new Set<() => void>();

	constructor(private readonly timeoutMs = 6_000) {}

	/** Wait for actual work cleanup, including work whose bounded result already rejected. */
	awaitIdle(): Promise<void> {
		return this.active?.settled ?? Promise.resolve();
	}

	invalidate(): void {
		this.active?.abort.abort(new Error('The observation was superseded.'));
	}

	run(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
		signal?.throwIfAborted();
		if (this.active) {
			if (this.active.abort.signal.aborted) {
				return this.waitForIdle(signal).then(() => this.run(work, signal));
			}
			return this.join(this.active, signal);
		}
		const abort = new AbortController();
		let rejectAborted: (reason: unknown) => void;
		const aborted = new Promise<never>((_, reject) => {
			rejectAborted = reject;
		});
		const onAbort = () => rejectAborted(abort.signal.reason);
		abort.signal.addEventListener('abort', onAbort, { once: true });
		const timer = setTimeout(() => abort.abort(new Error('The status observation timed out.')), this.timeoutMs);
		const pending = Promise.resolve().then(() => {
			abort.signal.throwIfAborted();
			return work(abort.signal);
		});
		const active = { abort, result: Promise.race([pending, aborted]), settled: Promise.resolve() };
		this.active = active;
		const settle = (): void => {
			clearTimeout(timer);
			abort.signal.removeEventListener('abort', onAbort);
			if (this.active === active) {
				this.active = null;
				for (const onIdle of this.idleWaiters) {
					onIdle();
				}
			}
		};
		active.settled = pending.then(settle, settle);
		return this.join(active, signal);
	}

	private waitForIdle(signal?: AbortSignal): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const cleanup = (): void => {
				clearTimeout(timer);
				signal?.removeEventListener('abort', onAbort);
				this.idleWaiters.delete(onIdle);
			};
			const onIdle = (): void => {
				cleanup();
				resolve();
			};
			const onAbort = (): void => {
				cleanup();
				reject(signal?.reason as Error);
			};
			const timer = setTimeout(() => {
				cleanup();
				reject(new Error('Waiting for the previous status observation timed out.'));
			}, this.timeoutMs);
			// Removable callbacks avoid retaining timed-out callers on work that never settles.
			this.idleWaiters.add(onIdle);
			signal?.addEventListener('abort', onAbort, { once: true });
			if (signal?.aborted) {
				onAbort();
			}
		});
	}

	private async join(active: { abort: AbortController; result: Promise<T> }, signal?: AbortSignal): Promise<T> {
		const onAbort = () => active.abort.abort(signal?.reason);
		signal?.addEventListener('abort', onAbort, { once: true });
		try {
			return await active.result;
		} finally {
			signal?.removeEventListener('abort', onAbort);
		}
	}
}
