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
		await vi.advanceTimersByTimeAsync(0);
		expect(store.get).toHaveBeenCalledTimes(1);
		status.data.value = { epoch: 'backend', revision: 3, state: 'connected' };
		await vi.advanceTimersByTimeAsync(10_000);
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
