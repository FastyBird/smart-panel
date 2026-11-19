import { createPinia, setActivePinia } from 'pinia';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RELAY_STATUS_POLL_MS, RELAY_STATUS_TIMEOUT_MS } from '../cameras.constants';

import { useRelayStatus } from './relay-status.store';

const { mockBackendClient, mockLogger } = vi.hoisted(() => ({
	mockBackendClient: { GET: vi.fn() },
	mockLogger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');
	const composables = await vi.importActual('../../../common/composables/composables');
	const services = await vi.importActual('../../../common/services/services');
	const store = await vi.importActual('../../../common/store/stores');
	const constants = await vi.importActual('../../../common/common.constants');

	return {
		...utils,
		...composables,
		...services,
		...store,
		...constants,
		useBackend: vi.fn(() => ({ client: mockBackendClient })),
		useLogger: vi.fn(() => mockLogger),
		logger: mockLogger,
	};
});

const statusRes = {
	relay: { mode: 'managed', state: 'running', reason: null, version: null },
	sessions: { active: 1, max: 8, max_per_camera: 4 },
};

const ok = { data: { data: statusRes }, error: undefined, response: { status: 200 } };

describe('Relay status store', () => {
	let store: ReturnType<typeof useRelayStatus>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		vi.useFakeTimers();
		(mockBackendClient.GET as Mock).mockResolvedValue(ok);

		store = useRelayStatus();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('relay status get coalesces concurrent calls', async () => {
		const [a, b] = await Promise.all([store.get(), store.get()]);

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
		expect(a.relay.reason).toBeNull();
		expect(a.sessions.maxPerCamera).toBe(4);
		expect(store.isLoaded()).toBe(true);
	});

	it('startPolling polls every 10 s while held and stops after the last release', async () => {
		const releaseA = store.startPolling();
		const releaseB = store.startPolling();

		await vi.advanceTimersByTimeAsync(0);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);

		releaseA();
		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(3);

		releaseB();
		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS * 3);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(3);
	});

	it('startPolling fetches immediately for the first holder only', async () => {
		const releaseA = store.startPolling();

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);

		const releaseB = store.startPolling();

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);

		releaseA();
		releaseB();
	});

	it('clears the read deadline once the read settles', async () => {
		await store.get();

		const [, init] = (mockBackendClient.GET as Mock).mock.calls[0];

		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(init.signal.aborted).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('aborts a stalled read after the deadline, so the next poll starts a new one', async () => {
		const signals: AbortSignal[] = [];

		(mockBackendClient.GET as Mock).mockImplementationOnce(
			(_path: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					signals.push(init.signal);
					init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				})
		);

		const release = store.startPolling();
		const stalled = store.get();

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);

		const outcome = stalled.then(
			() => 'resolved',
			() => 'rejected'
		);

		await vi.advanceTimersByTimeAsync(RELAY_STATUS_TIMEOUT_MS - 1);
		expect(signals[0].aborted).toBe(false);

		await vi.advanceTimersByTimeAsync(1);
		expect(signals[0].aborted).toBe(true);
		expect(await outcome).toBe('rejected');
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to poll the relay status.');

		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS - RELAY_STATUS_TIMEOUT_MS);

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
		expect(store.status?.relay.state).toBe('running');

		release();
	});

	it('the release function is idempotent', async () => {
		const releaseA = store.startPolling();
		const releaseB = store.startPolling();

		releaseA();
		releaseA();

		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);

		releaseB();
		await vi.advanceTimersByTimeAsync(RELAY_STATUS_POLL_MS * 2);
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
	});
});
