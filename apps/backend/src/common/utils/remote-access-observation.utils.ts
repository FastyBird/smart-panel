/** A bounded, provider-local read. The slot remains occupied until cancelled work has actually settled. */
export class RemoteAccessObservation<T> {
	private active: { abort: AbortController; result: Promise<T>; settled: Promise<void> } | null = null;

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
			}
		};
		active.settled = pending.then(settle, settle);
		return this.join(active, signal);
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
