import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesHomeyPluginTestCandidateConnectionMode,
	DevicesHomeyPluginTestSavedConnectionMode,
	DevicesUnifiProtectPluginTlsMode,
} from '../../../openapi.constants';
import { PROTECT_STATUS_DEADLINE_MS, PROTECT_TEST_CONNECTION_DEADLINE_MS, STATUS_POLL_MS } from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { useProtectStatus } from './protect-status.store';

const { get, post, mockLogger } = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	mockLogger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		useLogger: () => mockLogger,
		logger: mockLogger,
	};
});

const statusBody = (overrides: Record<string, unknown> = {}) => ({
	data: {
		data: {
			service_state: 'started',
			connection_state: 'connected',
			enabled: true,
			configured: true,
			healthy: true,
			tls_mode: 'verify',
			application_version: '6.2.88',
			minimum_version: '6.0.0',
			nvr_name: 'Console',
			reconnect_attempt: 0,
			realtime_state: 'streaming',
			ignored_event_count: 0,
			...overrides,
		},
	},
	response: { status: 200 },
});

const testBody = (overrides: Record<string, unknown> = {}) => ({
	data: { data: { mode: 'candidate', success: true, minimum_version: '6.0.0', ...overrides } },
	response: { status: 200 },
});

const hangUntilAborted = (_path: string, options?: { signal?: AbortSignal }) =>
	new Promise((_resolve, reject) => {
		options?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
	});

const setVisibility = (state: 'visible' | 'hidden'): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
	document.dispatchEvent(new Event('visibilitychange'));
};

const target = { host: '192.168.1.10', port: 443, tlsMode: DevicesUnifiProtectPluginTlsMode.verify };

describe('Protect status store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		vi.useFakeTimers();
		setVisibility('visible');
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('status', () => {
		it('loads and normalizes the status, keeping nulls', async () => {
			get.mockResolvedValue(statusBody({ application_version: null, last_error_category: null }));
			const store = useProtectStatus();

			await store.fetch();

			expect(get).toHaveBeenCalledWith('/plugins/devices-unifi-protect/status', expect.objectContaining({ signal: expect.any(AbortSignal) }));
			expect(store.status).toEqual(expect.objectContaining({ connectionState: 'connected', applicationVersion: null, tlsMode: 'verify' }));
			expect(store.stale).toBe(false);
		});

		it('coalesces concurrent fetches', async () => {
			get.mockResolvedValue(statusBody());
			const store = useProtectStatus();

			const [a, b] = await Promise.all([store.fetch(), store.fetch()]);

			expect(get).toHaveBeenCalledTimes(1);
			expect(a).toBe(b);
		});

		it('marks the status stale after a failed or timed out poll and clears it on success', async () => {
			get.mockResolvedValueOnce(statusBody());
			const store = useProtectStatus();
			await store.fetch();

			get.mockResolvedValueOnce({ error: { message: 'boom' }, response: { status: 503 } });
			await expect(store.fetch()).rejects.toBeInstanceOf(ProtectApiException);
			expect(store.stale).toBe(true);
			expect(store.status?.connectionState).toBe('connected');

			get.mockResolvedValueOnce(statusBody({ connection_state: 'degraded' }));
			await store.fetch();
			expect(store.stale).toBe(false);
			expect(store.status?.connectionState).toBe('degraded');

			get.mockImplementationOnce(hangUntilAborted);
			const pending = store.fetch();
			const assertion = expect(pending).rejects.toBeInstanceOf(ProtectTimeoutException);
			await vi.advanceTimersByTimeAsync(PROTECT_STATUS_DEADLINE_MS);
			await assertion;
			expect(store.stale).toBe(true);
		});

		it('aborts a stalled read at the deadline so the next poll starts a new one', async () => {
			get.mockImplementationOnce(hangUntilAborted);
			const store = useProtectStatus();
			const release = store.startPolling();

			expect(get).toHaveBeenCalledTimes(1);

			get.mockResolvedValue(statusBody());
			await vi.advanceTimersByTimeAsync(PROTECT_STATUS_DEADLINE_MS);
			expect(store.stale).toBe(true);

			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
			expect(get).toHaveBeenCalledTimes(2);
			expect(store.stale).toBe(false);
			expect(store.status).not.toBeNull();

			release();
		});

		it('reports whether it holds a status for the reconnect refresh', async () => {
			get.mockResolvedValue(statusBody());
			const store = useProtectStatus();

			expect(store.isLoaded()).toBe(false);
			await store.refresh();
			expect(store.isLoaded()).toBe(true);
		});
	});

	describe('polling', () => {
		it('polls every 5 s while held and stops after the last release', async () => {
			get.mockResolvedValue(statusBody());
			const store = useProtectStatus();

			const releaseA = store.startPolling();
			const releaseB = store.startPolling();
			expect(get).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
			expect(get).toHaveBeenCalledTimes(2);

			releaseA();
			releaseA();
			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
			expect(get).toHaveBeenCalledTimes(3);

			releaseB();
			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 3);
			expect(get).toHaveBeenCalledTimes(3);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('pauses while the page is hidden and fetches on return', async () => {
			get.mockResolvedValue(statusBody());
			const store = useProtectStatus();
			const release = store.startPolling();
			expect(get).toHaveBeenCalledTimes(1);

			setVisibility('hidden');
			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 4);
			expect(get).toHaveBeenCalledTimes(1);

			setVisibility('visible');
			await vi.advanceTimersByTimeAsync(0);
			expect(get).toHaveBeenCalledTimes(2);

			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
			expect(get).toHaveBeenCalledTimes(3);

			release();
		});

		it('does not fetch at start while hidden, and removes its listener on the last release', async () => {
			get.mockResolvedValue(statusBody());
			const add = vi.spyOn(document, 'addEventListener');
			const remove = vi.spyOn(document, 'removeEventListener');
			const store = useProtectStatus();

			setVisibility('hidden');
			const release = store.startPolling();
			expect(get).not.toHaveBeenCalled();

			release();
			const added = add.mock.calls.filter(([type]) => type === 'visibilitychange');
			const removed = remove.mock.calls.filter(([type]) => type === 'visibilitychange');
			expect(added).toHaveLength(1);
			expect(removed).toHaveLength(1);
			expect(removed[0][1]).toBe(added[0][1]);

			setVisibility('visible');
			await vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 2);
			expect(get).not.toHaveBeenCalled();

			add.mockRestore();
			remove.mockRestore();
		});
	});

	describe('test connection', () => {
		it('sends the saved and the candidate request shapes', async () => {
			post.mockResolvedValue(testBody({ mode: 'saved' }));
			const store = useProtectStatus();
			const saved = { data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } };

			await store.testConnection(saved, target);
			expect(post).toHaveBeenLastCalledWith('/plugins/devices-unifi-protect/test-connection', {
				body: saved,
				signal: expect.any(AbortSignal),
			});

			const candidate = {
				data: {
					mode: DevicesHomeyPluginTestCandidateConnectionMode.candidate,
					host: '192.168.1.10',
					port: 443,
					api_key: 'typed-secret',
					tls: { mode: DevicesUnifiProtectPluginTlsMode.verify, server_name: 'console.local' },
				},
			};
			await store.testConnection(candidate, target);
			expect(post).toHaveBeenLastCalledWith('/plugins/devices-unifi-protect/test-connection', {
				body: candidate,
				signal: expect.any(AbortSignal),
			});
		});

		it('keeps the target a result was run for', async () => {
			post.mockResolvedValue(testBody({ success: false, error_category: 'tls_untrusted' }));
			vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
			const store = useProtectStatus();

			const result = await store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } }, target);

			expect(store.lastTest).toEqual({
				result: expect.objectContaining({ success: false, errorCategory: 'tls_untrusted' }),
				target,
				at: Date.parse('2026-11-20T10:00:00Z'),
			});
			expect(result).toEqual(store.lastTest);

			store.clearLastTest();
			expect(store.lastTest).toBeNull();
		});

		it('reports a timeout without a failure category', async () => {
			post.mockImplementation(hangUntilAborted);
			const store = useProtectStatus();
			store.lastTest = { result: { mode: 'saved', success: true, minimumVersion: '6.0.0' }, target, at: 1 };

			const pending = store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } }, target);
			expect(store.testing).toBe(true);
			expect(store.lastTest).toBeNull();
			await vi.advanceTimersByTimeAsync(PROTECT_TEST_CONNECTION_DEADLINE_MS);

			await expect(pending).resolves.toEqual({ timedOut: true });
			expect(store.lastTest).toBeNull();
			expect(store.testing).toBe(false);
		});

		it('throws a sanitized API exception on a transport failure and restores idle state', async () => {
			post.mockResolvedValue({ error: new Error('private transport detail'), response: { status: 503 } });
			const store = useProtectStatus();

			await expect(store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } }, target)).rejects.toEqual(
				expect.objectContaining<Partial<ProtectApiException>>({ code: 503 })
			);
			expect(store.testing).toBe(false);
			expect(store.lastTest).toBeNull();
		});

		it('never stores the candidate key', async () => {
			const secret = 'typed-secret-key-123';
			post.mockResolvedValueOnce(testBody({ success: false, error_category: 'authentication', error: 'The API key was rejected.' }));
			const store = useProtectStatus();
			const candidate = {
				data: { mode: DevicesHomeyPluginTestCandidateConnectionMode.candidate, host: '192.168.1.10', api_key: secret },
			};

			await store.testConnection(candidate, target);

			expect(JSON.stringify(store.$state)).not.toContain(secret);

			post.mockResolvedValueOnce({ error: { message: 'Bad request' }, response: { status: 400 } });
			const failure = await store.testConnection(candidate, target).catch((error: Error) => error);
			expect(failure).toBeInstanceOf(ProtectApiException);
			expect(String((failure as Error).message)).not.toContain(secret);

			post.mockImplementationOnce(hangUntilAborted);
			const pending = store.testConnection(candidate, target);
			await vi.advanceTimersByTimeAsync(PROTECT_TEST_CONNECTION_DEADLINE_MS);
			await pending;

			expect(JSON.stringify(store.$state)).not.toContain(secret);
			for (const fn of Object.values(mockLogger)) {
				expect(JSON.stringify(fn.mock.calls)).not.toContain(secret);
			}
		});
	});
});
