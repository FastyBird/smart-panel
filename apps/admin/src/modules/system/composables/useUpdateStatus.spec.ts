import { type EffectScope, effectScope } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitUpdateEvent } from '../services/update-events.service';

import { useUpdateStatus } from './useUpdateStatus';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: mockGet, POST: mockPost } }),
	};
});

const response = (data: Record<string, unknown>) => ({ data: { data }, error: undefined });
const completed = response({ status: 'complete', current_version: '1.1.0-alpha.57', progress_percent: 100, error: null });

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((accept) => {
		resolve = accept;
	});

	return { promise, resolve };
};

describe('useUpdateStatus', () => {
	let scopes: EffectScope[];

	const consumer = () => {
		const scope = effectScope();
		scopes.push(scope);
		const api = scope.run(() => useUpdateStatus())!;

		return { scope, api };
	};

	beforeEach(() => {
		vi.useFakeTimers();
		scopes = [];
		mockGet.mockReset();
		mockPost.mockReset();
		mockPost.mockResolvedValue(response({}));
		emitUpdateEvent({ status: 'idle', phase: null, progress_percent: null, error: null, latest_version: '1.1.0-alpha.57' });
	});

	afterEach(() => {
		for (const scope of scopes) {
			scope.stop();
		}

		expect(vi.getTimerCount()).toBe(0);
		vi.useRealTimers();
	});

	it('recovers authoritative completion after more than five minutes offline', async () => {
		mockGet.mockRejectedValue(new Error('Backend offline'));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(6 * 60_000);

		expect(api.status.value).toBe('downloading');
		expect(api.error.value).toBeNull();
		expect(api.waitingForRestart.value).toBe(true);
		expect(api.progressPercent.value).toBe(90);
		expect(mockGet.mock.calls.length).toBeLessThanOrEqual(15);

		mockGet.mockResolvedValue(completed);
		await vi.advanceTimersByTimeAsync(30_000);

		expect(api.status.value).toBe('complete');
		expect(api.progressPercent.value).toBe(100);
		expect(api.waitingForRestart.value).toBe(false);
		expect(api.error.value).toBeNull();
		const calls = mockGet.mock.calls.length;
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mockGet).toHaveBeenCalledTimes(calls);
	});

	it('keeps a slow but reachable update pending beyond the former absolute deadline', async () => {
		mockGet.mockResolvedValue(response({ status: 'installing', progress_percent: 45, error: null }));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(31 * 60_000);

		expect(api.status.value).toBe('installing');
		expect(api.error.value).toBeNull();
		mockGet.mockResolvedValue(completed);
		await vi.advanceTimersByTimeAsync(4_000);
		expect(api.status.value).toBe('complete');
	});

	it('stops after explicit backend failure even when the installed version matches', async () => {
		mockGet.mockRejectedValue(new Error('Backend offline'));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(6 * 60_000);
		mockGet.mockResolvedValue(response({ status: 'failed', current_version: '1.1.0-alpha.57', error: 'Migration failed' }));
		await vi.advanceTimersByTimeAsync(30_000);

		expect(api.status.value).toBe('failed');
		expect(api.error.value).toBe('systemModule.messages.update.updateFailed');
		expect(api.waitingForRestart.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('retains compatibility with a restarted backend that clears status after completing', async () => {
		mockGet.mockResolvedValue(response({ status: 'idle', current_version: '1.1.0-alpha.57' }));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);

		expect(api.status.value).toBe('complete');
		expect(api.progressPercent.value).toBe(100);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([{ status: 'idle', current_version: '1.1.0-alpha.56' }, { current_version: '1.1.0-alpha.56' }, { status: 'idle' }, {}])(
		'keeps an unconfirmed cleared status pending: %j',
		async (unconfirmed) => {
			mockGet.mockResolvedValueOnce(response({ status: 'installing', phase: 'installing', progress_percent: 45, error: null }));
			const { api } = consumer();
			await api.installUpdate();
			await vi.advanceTimersByTimeAsync(4_000);
			mockGet.mockResolvedValue(response({ ...unconfirmed, phase: null, progress_percent: null, error: null }));
			await vi.advanceTimersByTimeAsync(4_000);

			expect(api.status.value).toBe('installing');
			expect(api.phase.value).toBe('installing');
			expect(api.installing.value).toBe(true);
			expect(api.progressPercent.value).toBe(45);
			expect(api.error.value).toBeNull();
			expect(api.waitingForRestart.value).toBe(true);
			await vi.advanceTimersByTimeAsync(8_000);
			expect(mockGet).toHaveBeenCalledTimes(3);
			expect(api.status.value).toBe('installing');

			mockGet.mockResolvedValue(response({ status: 'idle', current_version: '1.1.0-alpha.57' }));
			await vi.advanceTimersByTimeAsync(16_000);
			expect(api.status.value).toBe('complete');
			expect(api.progressPercent.value).toBe(100);
			expect(api.waitingForRestart.value).toBe(false);
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it.each([{ status: 'idle', current_version: '1.1.0-alpha.56' }, { current_version: '1.1.0-alpha.56' }, { status: 'idle' }, {}])(
		'preserves the pending update when the remount fetch is unconfirmed: %j',
		async (unconfirmed) => {
			mockGet.mockResolvedValue(response({ status: 'installing', phase: 'installing', progress_percent: 45, error: null }));
			const first = consumer();
			await first.api.installUpdate();
			await vi.advanceTimersByTimeAsync(4_000);
			first.scope.stop();
			const second = consumer();
			mockGet.mockResolvedValue(response({ ...unconfirmed, phase: null, progress_percent: null, error: null }));
			await second.api.fetchStatus();

			expect(second.api.status.value).toBe('installing');
			expect(second.api.phase.value).toBe('installing');
			expect(second.api.installing.value).toBe(true);
			expect(second.api.progressPercent.value).toBe(45);
			expect(second.api.waitingForRestart.value).toBe(true);
			expect(second.api.error.value).toBeNull();
			await vi.advanceTimersByTimeAsync(4_000);
			expect(mockGet).toHaveBeenCalledTimes(3);
			expect(second.api.status.value).toBe('installing');

			mockGet.mockResolvedValue(completed);
			await vi.advanceTimersByTimeAsync(8_000);
			expect(second.api.status.value).toBe('complete');
			expect(second.api.progressPercent.value).toBe(100);
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it.each(['complete', 'failed'])('settles an unconfirmed idle response on explicit %s', async (terminalStatus) => {
		mockGet.mockResolvedValue(response({ status: 'idle', current_version: '1.1.0-alpha.56' }));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		expect(api.status.value).toBe('downloading');
		mockGet.mockResolvedValue(response({ status: terminalStatus, error: terminalStatus === 'failed' ? 'Failed' : null }));
		await vi.advanceTimersByTimeAsync(8_000);

		expect(api.status.value).toBe(terminalStatus);
		expect(api.waitingForRestart.value).toBe(false);
		expect(api.installing.value).toBe(false);
		expect(api.error.value).toBe(terminalStatus === 'failed' ? 'systemModule.messages.update.updateFailed' : null);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not infer completion from the version while the backend still reports an update in progress', async () => {
		mockGet.mockResolvedValue(response({ status: 'starting', current_version: '1.1.0-alpha.57' }));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);

		expect(api.status.value).toBe('starting');
		expect(vi.getTimerCount()).toBe(1);
	});

	it('bounds hung requests without overlapping polls and retries after an abort', async () => {
		mockGet.mockImplementation(
			(_path, { signal }: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
				})
		);
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		const signal = mockGet.mock.calls[0][1].signal as AbortSignal;
		await vi.advanceTimersByTimeAsync(9_999);

		expect(signal.aborted).toBe(false);
		expect(mockGet).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(signal.aborted).toBe(true);
		expect(api.error.value).toBeNull();
		await vi.advanceTimersByTimeAsync(8_000);
		expect(mockGet).toHaveBeenCalledTimes(2);
	});

	it('does not cancel shared observation when one of two consumers leaves', async () => {
		mockGet.mockRejectedValue(new Error('Backend offline'));
		const first = consumer();
		const second = consumer();
		await first.api.installUpdate();
		first.scope.stop();
		await vi.advanceTimersByTimeAsync(4_000);

		expect(mockGet).toHaveBeenCalledTimes(1);
		mockGet.mockResolvedValue(completed);
		await vi.advanceTimersByTimeAsync(8_000);
		expect(second.api.status.value).toBe('complete');
	});

	it('aborts and ignores a late GET after the last consumer leaves', async () => {
		const pending = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValue(pending.promise);
		const { api, scope } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		const signal = mockGet.mock.calls[0][1].signal as AbortSignal;
		scope.stop();
		expect(signal.aborted).toBe(true);
		pending.resolve(completed);
		await vi.advanceTimersByTimeAsync(60_000);

		expect(api.status.value).toBe('downloading');
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it('shares a pending initial fetch after its first consumer leaves', async () => {
		const pending = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValueOnce(pending.promise).mockResolvedValue(completed);
		const first = consumer();
		const second = consumer();
		const firstFetch = first.api.fetchStatus();
		const secondFetch = second.api.fetchStatus();
		first.scope.stop();
		pending.resolve(response({ status: 'installing', progress_percent: 45, error: null }));
		await Promise.all([firstFetch, secondFetch]);

		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(second.api.status.value).toBe('installing');
		await vi.advanceTimersByTimeAsync(4_000);
		expect(second.api.status.value).toBe('complete');
	});

	it.each([0, 6_000])('starts a fresh initial fetch when an idle consumer returns after %i ms', async (delay) => {
		const oldRequest = deferred<ReturnType<typeof response>>();
		const newRequest = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise).mockResolvedValue(completed);
		const first = consumer();
		const oldFetch = first.api.fetchStatus();
		first.scope.stop();
		await vi.advanceTimersByTimeAsync(delay);
		const second = consumer();
		const newFetch = second.api.fetchStatus();
		expect(mockGet).toHaveBeenCalledTimes(2);

		oldRequest.resolve(completed);
		await oldFetch;
		expect(second.api.status.value).toBe('idle');
		expect(second.api.loading.value).toBe(true);
		const sharedFetch = second.api.fetchStatus();
		expect(mockGet).toHaveBeenCalledTimes(2);
		newRequest.resolve(response({ status: 'installing', error: null }));
		await Promise.all([newFetch, sharedFetch]);

		expect(second.api.status.value).toBe('installing');
		expect(second.api.loading.value).toBe(false);
		await vi.advanceTimersByTimeAsync(4_000);
		expect(second.api.status.value).toBe('complete');
	});

	it('ignores an initial status fetch superseded by an authoritative terminal socket event', async () => {
		const pending = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValueOnce(pending.promise);
		const { api } = consumer();
		const fetch = api.fetchStatus();
		emitUpdateEvent({ status: 'failed', error: 'Worker failed' });
		pending.resolve(response({ status: 'installing', error: null }));
		await fetch;

		expect(api.status.value).toBe('failed');
		expect(api.error.value).toBe('systemModule.messages.update.updateFailed');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('resumes after returning during an outage even when the initial status fetch fails', async () => {
		mockGet.mockRejectedValue(new Error('Backend offline'));
		const first = consumer();
		await first.api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		first.scope.stop();
		const second = consumer();
		await second.api.fetchStatus();
		const calls = mockGet.mock.calls.length;
		await vi.advanceTimersByTimeAsync(4_000);
		expect(mockGet).toHaveBeenCalledTimes(calls + 1);

		mockGet.mockResolvedValue(completed);
		await vi.advanceTimersByTimeAsync(8_000);
		expect(second.api.status.value).toBe('complete');
	});

	it.each(['complete', 'failed'])('keeps an authoritative %s socket event when an older GET resolves', async (status) => {
		const pending = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValue(pending.promise);
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		emitUpdateEvent({ status, error: status === 'failed' ? 'Worker failed' : null });
		pending.resolve(response({ status: 'installing', error: null }));
		await vi.advanceTimersByTimeAsync(60_000);

		expect(api.status.value).toBe(status);
		expect(api.waitingForRestart.value).toBe(false);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it('ignores an older poll when a new installation starts', async () => {
		const pending = deferred<ReturnType<typeof response>>();
		mockGet.mockReturnValueOnce(pending.promise).mockResolvedValue(response({ status: 'installing', error: null }));
		const { api } = consumer();
		await api.installUpdate();
		await vi.advanceTimersByTimeAsync(4_000);
		await api.installUpdate();
		pending.resolve(completed);
		await vi.advanceTimersByTimeAsync(0);

		expect(api.status.value).toBe('downloading');
		await vi.advanceTimersByTimeAsync(4_000);
		expect(api.status.value).toBe('installing');
	});

	it('does not start polling when the install response arrives after disposal', async () => {
		const pending = deferred<ReturnType<typeof response>>();
		mockPost.mockReturnValue(pending.promise);
		const { api, scope } = consumer();
		const install = api.installUpdate();
		scope.stop();
		pending.resolve(response({}));
		await install;
		await vi.advanceTimersByTimeAsync(60_000);

		expect(mockGet).not.toHaveBeenCalled();
		expect(api.status.value).toBe('downloading');
	});
});
