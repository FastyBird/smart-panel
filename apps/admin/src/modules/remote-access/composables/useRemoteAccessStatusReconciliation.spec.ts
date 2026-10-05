import { type EffectScope, type Ref, effectScope, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRemoteAccessStatusReconciliation } from './useRemoteAccessStatusReconciliation';

interface Snapshot {
	epoch?: string;
	revision?: number;
	state: string;
}

const scopes: EffectScope[] = [];
const subscribe = (
	store: { get: () => Promise<unknown> },
	source: { data: Ref<Snapshot | null>; semaphore: Ref<{ getting: boolean }> },
	hasOperation?: () => boolean
) => {
	const scope = effectScope();
	scopes.push(scope);
	scope.run(() => useRemoteAccessStatusReconciliation(store, source, hasOperation));
	return scope;
};
const source = (state = 'connected') => ({
	data: ref<Snapshot | null>({ epoch: 'backend', revision: 1, state }),
	semaphore: ref({ getting: false }),
});

const metadataStore = (status: ReturnType<typeof source>) => {
	const metadataRevision = ref(0);
	const startedReads: number[] = [];
	const get = vi.fn().mockImplementation(async () => {
		status.semaphore.value.getting = true;
		startedReads.push(Date.now());
		try {
			await new Promise<void>((resolve) => setTimeout(resolve, 20));
			const snapshot = { ...status.data.value! };
			metadataRevision.value = snapshot.revision!;
			status.data.value = snapshot;
			// The backend publishes every observation; its matching websocket echo can arrive
			// after the HTTP response has already released the store's GET semaphore.
			setTimeout(() => {
				status.data.value = { ...snapshot };
			}, 10);
		} finally {
			status.semaphore.value.getting = false;
		}
	});
	return { get, metadataRevision, startedReads };
};

describe('useRemoteAccessStatusReconciliation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		scopes.splice(0).forEach((scope) => scope.stop());
		vi.useRealTimers();
	});

	it('shares one worker between nonaligned scopes, retaining it until the last subscriber leaves', async () => {
		const status = source('connecting');
		const store = { get: vi.fn().mockResolvedValue(undefined) };
		const first = subscribe(store, status);
		await vi.advanceTimersByTimeAsync(2_000);
		const second = subscribe(store, status);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(3_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		first.stop();
		await vi.advanceTimersByTimeAsync(3_000);
		expect(store.get).toHaveBeenCalledTimes(2);
		second.stop();
		expect(vi.getTimerCount()).toBe(0);
		status.data.value = { epoch: 'backend', revision: 2, state: 'connected' };
		await vi.advanceTimersByTimeAsync(60_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});

	it('starts a fresh worker when a later consumer subscribes after all previous consumers leave', async () => {
		const status = source('connecting');
		const store = { get: vi.fn().mockResolvedValue(undefined) };
		subscribe(store, status).stop();
		subscribe(store, status);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(1);
	});

	it('retains the 30-second recovery fallback when the initial snapshot is absent and a retry fails', async () => {
		const status = source();
		status.data.value = null;
		const store = {
			get: vi
				.fn()
				.mockRejectedValueOnce(new Error('offline'))
				.mockImplementationOnce(async () => {
					status.semaphore.value.getting = true;
					status.data.value = { epoch: 'backend', revision: 1, state: 'connected' };
					status.semaphore.value.getting = false;
				}),
		};
		subscribe(store, status);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		expect(status.data.value).toBeNull();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(store.get).toHaveBeenCalledTimes(2);
		expect(status.data.value).toMatchObject({ state: 'connected' });
	});

	it('uses the 5-second cadence for a private provider operation even with a stable public state', async () => {
		const status = source();
		const busy = ref(true);
		const store = { get: vi.fn().mockResolvedValue(undefined) };
		subscribe(store, status, () => busy.value);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		busy.value = false;
		await vi.advanceTimersByTimeAsync(25_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});

	it.each([
		{ state: 'pending-auth', hasOperation: false },
		{ state: 'connected', hasOperation: true },
	])('shares the request budget with a 3-second caller during $state (operation: $hasOperation)', async ({ state, hasOperation }) => {
		const status = source(state);
		const successfulReads: number[] = [];
		const store = {
			get: vi.fn().mockImplementation(async () => {
				if (status.semaphore.value.getting) throw new Error('Already getting status');
				status.semaphore.value.getting = true;
				try {
					await Promise.resolve();
					successfulReads.push(Date.now());
				} finally {
					status.semaphore.value.getting = false;
				}
			}),
		};
		subscribe(store, status, () => hasOperation);
		const externalPoller = setInterval(() => void store.get(), 3_000);
		try {
			await vi.advanceTimersByTimeAsync(60_000);
			expect(successfulReads).toHaveLength(20);
			expect(successfulReads.length).toBeLessThanOrEqual(30);
		} finally {
			clearInterval(externalPoller);
		}
		await vi.advanceTimersByTimeAsync(5_000);
		expect(successfulReads).toHaveLength(21);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(successfulReads).toHaveLength(22);
	});

	it.each([false, true])('resumes the stable fallback after an external read (failed: %s)', async (failed) => {
		const status = source();
		status.data.value = null;
		const store = {
			get: vi.fn().mockImplementation(async () => {
				status.semaphore.value.getting = true;
				try {
					await Promise.resolve();
					if (failed) throw new Error('offline');
					status.data.value = { epoch: 'backend', revision: 1, state: 'connected' };
				} finally {
					status.semaphore.value.getting = false;
				}
			}),
		};
		subscribe(store, status);
		await vi.advanceTimersByTimeAsync(25_000);
		await store.get().catch(() => undefined);
		await vi.advanceTimersByTimeAsync(25_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});

	it('waits for the active cadence after a long external read completes', async () => {
		const status = source('pending-auth');
		const store = {
			get: vi.fn().mockImplementation(async () => {
				status.semaphore.value.getting = true;
				try {
					await new Promise<void>((resolve) => setTimeout(resolve, 8_000));
				} finally {
					status.semaphore.value.getting = false;
				}
			}),
		};
		subscribe(store, status);
		await vi.advanceTimersByTimeAsync(4_500);
		const externalRead = store.get();
		await vi.advanceTimersByTimeAsync(10_500);
		await externalRead;
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});

	it('reconciles version changes once while ignoring equal versions and GET commits', async () => {
		const status = source();
		const store = {
			get: vi.fn().mockImplementation(async () => {
				status.semaphore.value.getting = true;
				status.data.value = { epoch: 'backend', revision: 3, state: 'connected' };
				status.semaphore.value.getting = false;
			}),
		};
		subscribe(store, status);
		subscribe(store, status);
		status.data.value = { epoch: 'backend', revision: 2, state: 'disconnected' };
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		status.data.value = { epoch: 'backend', revision: 3, state: 'connected' };
		await vi.advanceTimersByTimeAsync(10_000);
		expect(store.get).toHaveBeenCalledTimes(1);
	});

	it('coalesces 20 publication revisions into one trailing read of the latest private metadata', async () => {
		const status = source();
		const store = metadataStore(status);
		subscribe(store, status);
		subscribe(store, status);
		for (let revision = 2; revision <= 21; revision++) {
			await vi.advanceTimersByTimeAsync(100);
			status.data.value = { epoch: 'backend', revision, state: 'connected' };
		}
		expect(store.get).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(2_999);
		expect(store.get).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(21);
		expect(store.get).toHaveBeenCalledTimes(1);
		expect(store.metadataRevision.value).toBe(21);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(store.get).toHaveBeenCalledTimes(1);
	});

	it('bounds reconciliation during 600 new publication revisions over one minute', async () => {
		const status = source();
		const store = metadataStore(status);
		subscribe(store, status);
		for (let revision = 2; revision <= 601; revision++) {
			await vi.advanceTimersByTimeAsync(100);
			status.data.value = { epoch: 'backend', revision, state: 'connected' };
		}
		expect(store.startedReads).toHaveLength(11);
		for (let index = 1; index < store.startedReads.length; index++) {
			expect(store.startedReads[index] - store.startedReads[index - 1]).toBeGreaterThanOrEqual(5_020);
		}
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(12);
		expect(store.metadataRevision.value).toBe(601);
	});

	it('does not turn a delayed matching publication echo into another metadata read', async () => {
		const status = source();
		const store = metadataStore(status);
		subscribe(store, status);
		const read = store.get();
		await vi.advanceTimersByTimeAsync(20);
		await read;
		await vi.advanceTimersByTimeAsync(29_999);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});

	it('keeps failed event reconciliation pending without retrying before five seconds after completion', async () => {
		const status = source();
		const store = metadataStore(status);
		store.get.mockImplementationOnce(async () => {
			status.semaphore.value.getting = true;
			try {
				await new Promise<void>((resolve) => setTimeout(resolve, 20));
				throw new Error('offline');
			} finally {
				status.semaphore.value.getting = false;
			}
		});
		subscribe(store, status);
		status.data.value = { epoch: 'backend', revision: 2, state: 'connected' };
		await vi.advanceTimersByTimeAsync(5_020);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(4_999);
		expect(store.get).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(21);
		expect(store.get).toHaveBeenCalledTimes(2);
		expect(store.metadataRevision.value).toBe(2);
	});

	it('lets a three-second external poller satisfy pending event metadata reads', async () => {
		const status = source();
		const store = metadataStore(status);
		subscribe(store, status);
		const poller = setInterval(() => void store.get(), 3_000);
		try {
			for (let revision = 2; revision <= 601; revision++) {
				await vi.advanceTimersByTimeAsync(100);
				status.data.value = { epoch: 'backend', revision, state: 'connected' };
			}
			await vi.advanceTimersByTimeAsync(30);
			expect(store.get).toHaveBeenCalledTimes(20);
			expect(store.metadataRevision.value).toBe(601);
		} finally {
			clearInterval(poller);
		}
		await vi.advanceTimersByTimeAsync(25_000);
		expect(store.get).toHaveBeenCalledTimes(20);
	});

	it('retains a queued event read until the last subscriber leaves, then cancels it', async () => {
		const status = source();
		const store = metadataStore(status);
		const first = subscribe(store, status);
		const second = subscribe(store, status);
		status.data.value = { epoch: 'backend', revision: 2, state: 'connected' };
		first.stop();
		await vi.advanceTimersByTimeAsync(5_030);
		expect(store.get).toHaveBeenCalledTimes(1);
		status.data.value = { epoch: 'backend', revision: 3, state: 'connected' };
		second.stop();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(store.get).toHaveBeenCalledTimes(1);
	});

	it('coalesces ticks during an outstanding read and honors the store GET guard', async () => {
		const status = source('connecting');
		let finish!: () => void;
		const store = {
			get: vi.fn().mockReturnValue(
				new Promise<void>((resolve) => {
					finish = resolve;
				})
			),
		};
		status.semaphore.value.getting = true;
		subscribe(store, status);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).not.toHaveBeenCalled();
		status.semaphore.value.getting = false;
		await vi.advanceTimersByTimeAsync(15_000);
		expect(store.get).toHaveBeenCalledTimes(1);
		finish();
		await vi.advanceTimersByTimeAsync(5_000);
		expect(store.get).toHaveBeenCalledTimes(2);
	});
});
