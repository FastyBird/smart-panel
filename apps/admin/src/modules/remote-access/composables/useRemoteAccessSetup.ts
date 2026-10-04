import { type Ref, computed, effectScope, getCurrentScope, onScopeDispose, ref, watch } from 'vue';

export interface RemoteAccessSetupProgress {
	type: string;
	job: string;
	state: 'running' | 'complete' | 'failed' | 'timeout';
	step?: string;
	message?: string;
}

interface SetupJob {
	jobId: string;
	state: RemoteAccessSetupProgress['state'];
	step: string | null;
	message: string | null;
}

interface SetupSource {
	data: Ref<{ epoch?: string; setup?: SetupJob | null } | null>;
	setupProgress: Ref<RemoteAccessSetupProgress | null>;
	get: () => Promise<unknown>;
	install: () => Promise<{ job: string }>;
}

// One reconciliation loop per store. Callers retain their own subscription, so hiding or
// unmounting one wizard cannot stop another and a stopped watcher cannot restart a timer.
// The worker has a ten-minute hard deadline. Allow two minutes for a final REST read.
const RECONCILIATION_TIMEOUT_MS = 12 * 60 * 1000;

const sessions = new WeakMap<object, ReturnType<typeof createSession>>();

const createSession = (source: SetupSource, type: string, interval: number) => {
	const scope = effectScope(true);
	const subscribers = new Set<Ref<boolean>>();
	const currentJob = ref<string | null>(null);
	const terminal = ref<RemoteAccessSetupProgress | null>(null);
	const polling = ref(false);
	const retired = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: Promise<void> | null = null;
	let accepted = false;
	let acceptedEpoch: string | null = null;
	let startedAt = 0;
	let disposed = false;

	const progress = computed<RemoteAccessSetupProgress | null>(() => {
		if (!currentJob.value) return null;
		if (terminal.value) return terminal.value;
		const event = source.setupProgress.value;
		if (event?.job === currentJob.value) return event;
		const status = source.data.value?.setup;
		if (status?.jobId === currentJob.value) {
			return { type, job: status.jobId, state: status.state, step: status.step ?? undefined, message: status.message ?? undefined };
		}
		return { type, job: currentJob.value, state: 'running' };
	});

	const wanted = (): boolean => [...subscribers].some((subscriber) => subscriber.value) && currentJob.value !== null && terminal.value === null;
	const clearTimer = (): void => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	};
	const schedule = (): void => {
		if (currentJob.value && terminal.value === null && Date.now() - startedAt >= RECONCILIATION_TIMEOUT_MS) {
			terminal.value = { type, job: currentJob.value, state: 'timeout' };
			accepted = false;
		}
		polling.value = wanted();
		if (!polling.value) {
			clearTimer();
			return;
		}
		if (timer !== null || pending) return;
		timer = setTimeout(() => {
			timer = null;
			void read();
		}, interval);
	};
	const read = (): Promise<void> => {
		if (pending) return pending;
		clearTimer();
		// Store reads have an HTTP deadline and also coalesce with manual refreshes.
		// Retain this slot until settlement; retries cannot accumulate abandoned requests.
		pending = source
			.get()
			.then(() => undefined)
			.catch(() => {
				// An accepted job remains accepted when a status read fails. Retry on the next tick.
			})
			.finally(() => {
				pending = null;
				schedule();
			});
		return pending;
	};
	const adopt = (job: string): void => {
		if (currentJob.value === job) return;
		if (currentJob.value && currentJob.value !== job) retired.add(currentJob.value);
		currentJob.value = job;
		startedAt = Date.now();
		terminal.value = null;
	};
	const observe = (): void => {
		const status = source.data.value?.setup;
		const event = source.setupProgress.value;
		if (accepted && acceptedEpoch && source.data.value?.epoch && source.data.value.epoch !== acceptedEpoch && status?.jobId !== currentJob.value) {
			terminal.value = { type, job: currentJob.value!, state: 'timeout' };
			accepted = false;
		}
		if (!accepted) {
			if (status && !retired.has(status.jobId) && (currentJob.value === null || status.state === 'running')) adopt(status.jobId);
			if (event && !retired.has(event.job) && currentJob.value === null) adopt(event.job);
		}
		if (status?.jobId === currentJob.value && status.state !== 'running') {
			terminal.value = { type, job: status.jobId, state: status.state, step: status.step ?? undefined, message: status.message ?? undefined };
			accepted = false;
		}
		schedule();
		// A terminal event is a cue to reconcile requirements as well. Keep retrying until
		// authoritative REST confirms this job, including when its final event was missed.
		if (wanted() && event?.job === currentJob.value && event.state !== 'running') void read();
	};
	scope.run(() => watch([source.data, source.setupProgress], observe, { immediate: true, flush: 'sync' }));

	return {
		progress,
		polling,
		subscribers,
		schedule,
		install: async (): Promise<string> => {
			const result = await source.install();
			if (disposed) return result.job;
			adopt(result.job);
			accepted = true;
			acceptedEpoch = source.data.value?.epoch ?? null;
			// Do not await the observation: a failed GET must not turn a successful POST
			// into an installation error, and no websocket event is needed to start fallback.
			schedule();
			if (wanted()) void read();
			return result.job;
		},
		dispose: (): void => {
			disposed = true;
			clearTimer();
			scope.stop();
		},
	};
};

export const useRemoteAccessSetup = (store: object, source: SetupSource, type: string, interval: number) => {
	let session = sessions.get(store);
	if (!session) {
		session = createSession(source, type, interval);
		sessions.set(store, session);
	}
	const shared = session;
	const active = ref(true);
	shared.subscribers.add(active);
	shared.schedule();
	const stopPolling = (): void => {
		active.value = false;
		shared.schedule();
	};
	const startPolling = (): void => {
		active.value = true;
		shared.schedule();
	};
	if (getCurrentScope())
		onScopeDispose(() => {
			shared.subscribers.delete(active);
			shared.schedule();
			if (shared.subscribers.size === 0) {
				shared.dispose();
				sessions.delete(store);
			}
		});
	return {
		progress: shared.progress,
		isPolling: computed(() => active.value && shared.polling.value),
		install: shared.install,
		startPolling,
		stopPolling,
	};
};
