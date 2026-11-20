import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS,
	PROTECT_DISCOVERY_FOLLOW_MS,
	PROTECT_DISCOVERY_SCAN_DEADLINE_MS,
	PROTECT_PROBE_DEADLINE_MS,
} from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectScanStillRunningException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { protectProbeKey, useProtectDiscovery } from './protect-discovery.store';

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

const probeBody = (overrides: Record<string, unknown> = {}) => ({
	host: '192.168.1.10',
	port: 443,
	status: 'console',
	protect: 'present',
	direct_connect_domain: 'abc.ui.direct',
	preferred_host: 'abc.ui.direct',
	...overrides,
});

const discoveryBody = (overrides: Record<string, unknown> = {}) => ({
	data: {
		data: {
			status: 'completed',
			warnings: [],
			started_at: '2026-11-20T10:00:00Z',
			finished_at: null,
			failure_reason: null,
			interfaces: [{ name: 'en0', address: '192.168.1.5', broadcast_address: '192.168.1.255', status: 'ok' }],
			consoles: [
				{
					mac: 'aa:bb:cc:dd:ee:ff',
					host: '192.168.1.10',
					addresses: ['192.168.1.10'],
					hostname: null,
					direct_connect_domain: null,
					probe: probeBody(),
				},
			],
			other_unifi_devices: 0,
			...overrides,
		},
	},
	response: { status: 200 },
});

const hangUntilAborted = (_path: string, options?: { signal?: AbortSignal }) =>
	new Promise((_resolve, reject) => {
		options?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
	});

const SLOW_READ_MS = 7_000;

const answerAfter = (ms: number, body: unknown, options?: { signal?: AbortSignal }) =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => resolve(body), ms);

		options?.signal?.addEventListener('abort', () => {
			clearTimeout(timer);
			reject(new DOMException('The operation was aborted.', 'AbortError'));
		});
	});

describe('Protect discovery store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('loads the cached discovery', async () => {
		get.mockResolvedValue(discoveryBody());
		const store = useProtectDiscovery();

		await store.fetch();

		expect(get).toHaveBeenCalledWith('/plugins/devices-unifi-protect/discovery', expect.objectContaining({ signal: expect.any(AbortSignal) }));
		expect(store.discovery?.consoles).toHaveLength(1);
		expect(store.discovery?.consoles[0].probe.status).toBe('console');
		expect(store.discovery?.consoles[0].probe.preferredHost).toBe('abc.ui.direct');
		expect(store.discovery?.interfaces[0].broadcastAddress).toBe('192.168.1.255');
		expect(store.discovery?.startedAt).toBe('2026-11-20T10:00:00Z');
		expect(store.discovery?.failureReason).toBeNull();
	});

	it('coalesces concurrent fetches', async () => {
		get.mockResolvedValue(discoveryBody());
		const store = useProtectDiscovery();

		const [a, b] = await Promise.all([store.fetch(), store.fetch()]);

		expect(get).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
	});

	it('does not let an older read overwrite a newer scan', async () => {
		let resolveRead: ((value: ReturnType<typeof discoveryBody>) => void) | undefined;
		get.mockReturnValueOnce(new Promise<ReturnType<typeof discoveryBody>>((resolve) => (resolveRead = resolve)));
		post.mockResolvedValue(discoveryBody({ status: 'completed', other_unifi_devices: 5 }));
		const store = useProtectDiscovery();

		const read = store.fetch();
		await store.scan();
		resolveRead?.(discoveryBody({ status: 'scanning', other_unifi_devices: 0 }));
		const stale = await read;

		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.otherUnifiDevices).toBe(5);
		expect(stale.otherUnifiDevices).toBe(5);
	});

	it('does not let an older read overwrite a newer one that finished first', async () => {
		let resolveFirst: ((value: ReturnType<typeof discoveryBody>) => void) | undefined;
		get.mockReturnValueOnce(new Promise<ReturnType<typeof discoveryBody>>((resolve) => (resolveFirst = resolve)));
		const store = useProtectDiscovery();

		const first = store.fetch();
		// A scan timeout re-reads without coalescing onto the older read.
		post.mockImplementationOnce(hangUntilAborted);
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 7 }));
		const scan = store.scan();
		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);
		await scan;

		resolveFirst?.(discoveryBody({ status: 'idle', other_unifi_devices: 0 }));
		await first;

		expect(store.discovery?.otherUnifiDevices).toBe(7);
	});

	it('publishes the scan result', async () => {
		post.mockResolvedValue(discoveryBody({ status: 'completed', other_unifi_devices: 2 }));
		const store = useProtectDiscovery();

		await store.scan();

		expect(post).toHaveBeenCalledWith('/plugins/devices-unifi-protect/discovery/scan', expect.objectContaining({ signal: expect.any(AbortSignal) }));
		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.otherUnifiDevices).toBe(2);
		expect(store.scanning).toBe(false);
	});

	it('re-reads the cached discovery after a scan timeout', async () => {
		post.mockImplementation(hangUntilAborted);
		get.mockResolvedValue(discoveryBody({ status: 'completed' }));
		const store = useProtectDiscovery();

		const pending = store.scan();
		expect(store.scanning).toBe(true);
		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);
		const result = await pending;

		expect(get).toHaveBeenCalledTimes(1);
		expect(result?.status).toBe('completed');
		expect(store.discovery?.status).toBe('completed');
		expect(store.scanning).toBe(false);
	});

	it('follows a scan that outlives the client deadline, keeping the earlier consoles, until the backend reports its end', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockImplementation(hangUntilAborted);
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [], other_unifi_devices: 0 }));
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [], other_unifi_devices: 0 }));
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', consoles: [], other_unifi_devices: 1 }));

		const pending = store.scan();
		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		// The backend still scans: the progress stays, and its empty interim answer does not replace the list.
		expect(get).toHaveBeenCalledTimes(2);
		expect(store.scanning).toBe(true);
		expect(store.discovery?.status).toBe('scanning');
		expect(store.discovery?.consoles).toHaveLength(1);
		expect(store.discovery?.otherUnifiDevices).toBe(3);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		expect(get).toHaveBeenCalledTimes(3);
		expect(store.scanning).toBe(true);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		const result = await pending;

		expect(get).toHaveBeenCalledTimes(4);
		expect(result.status).toBe('completed');
		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.consoles).toHaveLength(0);
		expect(store.discovery?.otherUnifiDevices).toBe(1);
		expect(store.scanning).toBe(false);
	});

	it('follows a scan in progress that a fetch finds, such as one started elsewhere', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [] }));
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed' }));
		const store = useProtectDiscovery();

		const pending = store.fetch();
		await vi.advanceTimersByTimeAsync(0);

		expect(store.scanning).toBe(true);
		expect(store.discovery?.status).toBe('scanning');

		// A scan asked for meanwhile joins the one in progress rather than starting another.
		const joined = store.scan();

		expect(post).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		expect((await pending).status).toBe('completed');
		expect((await joined).status).toBe('completed');
		expect(store.discovery?.consoles).toHaveLength(1);
		expect(store.scanning).toBe(false);
	});

	it('stops following a scan that never ends and goes back to what it held before', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();
		const before = store.discovery;

		get.mockResolvedValue(discoveryBody({ status: 'scanning', consoles: [] }));
		post.mockImplementation(hangUntilAborted);

		const pending = store.scan();
		const outcome = expect(pending).rejects.toBeInstanceOf(ProtectScanStillRunningException);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS + PROTECT_DISCOVERY_FOLLOW_MS);
		await outcome;

		// The first fetch, then one read when the deadline expired and one per interval until the follow's time is up.
		expect(get).toHaveBeenCalledTimes(1 + PROTECT_DISCOVERY_FOLLOW_MS / PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		expect(store.discovery).toEqual(before);
		expect(store.scanning).toBe(false);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_MS);

		expect(get).toHaveBeenCalledTimes(1 + PROTECT_DISCOVERY_FOLLOW_MS / PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
	});

	it('counts the time reads take toward the follow, so slow answers still end it on time', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();
		const before = store.discovery;

		// Every read answers "scanning" after 7 s, inside the 8 s read deadline.
		get.mockImplementation((_path: string, options?: { signal?: AbortSignal }) =>
			answerAfter(SLOW_READ_MS, discoveryBody({ status: 'scanning', consoles: [] }), options)
		);
		post.mockImplementation(hangUntilAborted);

		const pending = store.scan();
		const outcome = expect(pending).rejects.toBeInstanceOf(ProtectScanStillRunningException);
		let settledAt: number | null = null;

		pending.catch(() => (settledAt = Date.now()));

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		const followStart = Date.now();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_MS - 1);

		expect(settledAt).toBeNull();
		expect(store.scanning).toBe(true);

		await vi.advanceTimersByTimeAsync(1);
		await outcome;

		expect(settledAt).toBe(followStart + PROTECT_DISCOVERY_FOLLOW_MS);
		// Reads start every 10 s (7 s answer + 3 s pause): at 0, 10, 20, 30, 40 and 50 s.
		expect(get).toHaveBeenCalledTimes(1 + 6);
		expect(store.discovery).toEqual(before);
		expect(store.scanning).toBe(false);
	});

	it('ends the follow on time with the read failure when the backend never answers', async () => {
		const store = useProtectDiscovery();

		get.mockImplementation(hangUntilAborted);
		post.mockImplementation(hangUntilAborted);

		const pending = store.scan();
		let error: unknown = null;
		let settledAt: number | null = null;

		pending.catch((reason: unknown) => {
			error = reason;
			settledAt = Date.now();
		});

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		const followStart = Date.now();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_MS);

		// The last read is cut to the time left; the failure reported is the last full read's, not a still running scan.
		expect(settledAt).toBe(followStart + PROTECT_DISCOVERY_FOLLOW_MS);
		expect(error).toBeInstanceOf(ProtectTimeoutException);
		expect(error).not.toBeInstanceOf(ProtectScanStillRunningException);
		expect(store.discovery).toBeNull();
		expect(store.scanning).toBe(false);
	});

	it('retries a failed read while following and applies the result that follows it', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockImplementation(hangUntilAborted);
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [] }));
		get.mockResolvedValueOnce({ error: { message: 'busy' }, response: { status: 503 } });
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', consoles: [], other_unifi_devices: 4 }));

		const pending = store.scan();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS + PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		// The failed read did not end the follow: the backend may still be scanning.
		expect(get).toHaveBeenCalledTimes(3);
		expect(store.scanning).toBe(true);
		expect(store.discovery?.status).toBe('scanning');
		expect(store.discovery?.otherUnifiDevices).toBe(3);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		const result = await pending;

		expect(get).toHaveBeenCalledTimes(4);
		expect(result.status).toBe('completed');
		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.otherUnifiDevices).toBe(4);
		expect(store.scanning).toBe(false);
	});

	it('keeps a result a concurrent fetch applied when a follow read then fails', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockImplementation(hangUntilAborted);
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [] }));

		let failFollowRead: (() => void) | undefined;

		get.mockReturnValueOnce(new Promise((resolve) => (failFollowRead = () => resolve({ error: { message: 'busy' }, response: { status: 503 } }))));

		const pending = store.scan();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS + PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		expect(get).toHaveBeenCalledTimes(3);

		// Meanwhile another read finds the scan done, with two consoles.
		const twoConsoles = discoveryBody({ status: 'completed', other_unifi_devices: 0 });

		twoConsoles.data.data.consoles = [
			...twoConsoles.data.data.consoles,
			{ ...twoConsoles.data.data.consoles[0], mac: '11:22:33:44:55:66', host: '192.168.1.11' },
		];
		get.mockResolvedValueOnce(twoConsoles);

		await store.fetch();

		expect(store.discovery?.consoles).toHaveLength(2);

		failFollowRead?.();
		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		const result = await pending;

		// The follow ends with that newer result instead of putting back the one from before the scan.
		expect(get).toHaveBeenCalledTimes(4);
		expect(result.consoles).toHaveLength(2);
		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.consoles).toHaveLength(2);
		expect(store.scanning).toBe(false);
	});

	it.each([
		['a late "scanning" answer', { status: 'scanning', consoles: [] }],
		['an older finished answer', { status: 'completed', other_unifi_devices: 1 }],
	])('drops %s of a follow read once a concurrent fetch applied a newer completion', async (_name, late) => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockImplementation(hangUntilAborted);
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [] }));

		let answerFollowRead: (() => void) | undefined;

		get.mockReturnValueOnce(new Promise((resolve) => (answerFollowRead = () => resolve(discoveryBody(late)))));

		const pending = store.scan();

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS + PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		expect(get).toHaveBeenCalledTimes(3);

		// Meanwhile another read finds the scan done.
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 9 }));
		await store.fetch();

		expect(store.discovery?.otherUnifiDevices).toBe(9);

		// Later reads would fail: the follow must not need them to keep the completion.
		get.mockResolvedValue({ error: { message: 'busy' }, response: { status: 503 } });

		answerFollowRead?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(store.discovery?.status).toBe('completed');
		expect(store.discovery?.otherUnifiDevices).toBe(9);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		const result = await pending;

		expect(get).toHaveBeenCalledTimes(4);
		expect(result.status).toBe('completed');
		expect(result.otherUnifiDevices).toBe(9);
		expect(store.discovery?.otherUnifiDevices).toBe(9);
		expect(store.scanning).toBe(false);
	});

	it('goes back to the newest finished result, not the one from before the scan, when a follow gives up', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockImplementation(hangUntilAborted);

		const pending = store.scan();
		const outcome = expect(pending).rejects.toBeInstanceOf(ProtectScanStillRunningException);

		// While the scan request runs, a read finds a finished result with other devices.
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 9 }));
		await store.fetch();
		const newer = store.discovery;

		get.mockResolvedValue(discoveryBody({ status: 'scanning', consoles: [] }));

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_SCAN_DEADLINE_MS + PROTECT_DISCOVERY_FOLLOW_MS);
		await outcome;

		expect(store.discovery).toEqual(newer);
		expect(store.discovery?.otherUnifiDevices).toBe(9);
		expect(store.scanning).toBe(false);
	});

	it('does not re-read the cache after the backend refuses the scan', async () => {
		post.mockResolvedValue({ error: { message: 'nope' }, response: { status: 403 } });
		const store = useProtectDiscovery();

		await expect(store.scan()).rejects.toBeInstanceOf(ProtectApiException);

		expect(get).not.toHaveBeenCalled();
		expect(store.scanning).toBe(false);
	});

	it('puts back the finished result when the backend refuses a scan a read meanwhile showed as running', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();
		const before = store.discovery;

		let refuse: (() => void) | undefined;

		post.mockReturnValueOnce(new Promise((resolve) => (refuse = () => resolve({ error: { message: 'Forbidden' }, response: { status: 403 } }))));

		const pending = store.scan();
		const outcome = expect(pending).rejects.toBeInstanceOf(ProtectApiException);

		// A read while the request runs finds the backend scanning and joins the scan.
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [], started_at: '2026-11-20T11:00:00Z' }));
		const joined = store.fetch();
		const joinedOutcome = expect(joined).rejects.toBeInstanceOf(ProtectApiException);
		await vi.advanceTimersByTimeAsync(0);

		expect(store.discovery?.status).toBe('scanning');
		expect(store.scanning).toBe(true);

		refuse?.();
		await outcome;
		await joinedOutcome;

		expect(store.discovery).toEqual(before);
		expect(store.scanning).toBe(false);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_MS);

		expect(get).toHaveBeenCalledTimes(2);
	});

	it('follows the backend scan after a server error on the scan request', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();

		post.mockResolvedValueOnce({ error: { message: 'Bad Gateway' }, response: { status: 502 } });
		get.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [], started_at: '2026-11-20T11:00:00Z' }));
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 4, started_at: '2026-11-20T11:00:00Z' }));

		const pending = store.scan();
		await vi.advanceTimersByTimeAsync(0);

		expect(get).toHaveBeenCalledTimes(2);
		expect(store.scanning).toBe(true);
		expect(store.discovery?.status).toBe('scanning');
		expect(store.discovery?.otherUnifiDevices).toBe(3);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);
		const result = await pending;

		expect(result.status).toBe('completed');
		expect(store.discovery?.otherUnifiDevices).toBe(4);
		expect(store.scanning).toBe(false);
	});

	it('reports a server error on the scan request when the backend shows no newer scan', async () => {
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));
		const store = useProtectDiscovery();

		await store.fetch();
		const before = store.discovery;

		post.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', other_unifi_devices: 3 }));

		await expect(store.scan()).rejects.toBeInstanceOf(TypeError);

		expect(get).toHaveBeenCalledTimes(2);
		expect(store.discovery).toEqual(before);
		expect(store.scanning).toBe(false);
	});

	it('follows a scan whose request answered before the scan finished', async () => {
		post.mockResolvedValueOnce(discoveryBody({ status: 'scanning', consoles: [], started_at: '2026-11-20T11:00:00Z' }));
		get.mockResolvedValueOnce(discoveryBody({ status: 'completed', started_at: '2026-11-20T11:00:00Z' }));
		const store = useProtectDiscovery();

		const pending = store.scan();
		await vi.advanceTimersByTimeAsync(0);

		expect(store.scanning).toBe(true);

		await vi.advanceTimersByTimeAsync(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

		expect((await pending).status).toBe('completed');
		expect(store.discovery?.status).toBe('completed');
		expect(store.scanning).toBe(false);
	});

	it('keeps probe results per host and port', async () => {
		post.mockImplementation(async (_path: string, options: { body: { data: { host: string; port?: number } } }) => ({
			data: { data: probeBody({ host: options.body.data.host, port: options.body.data.port ?? 443 }) },
			response: { status: 200 },
		}));
		const store = useProtectDiscovery();

		await store.probe({ host: '192.168.1.10' });
		await store.probe({ host: '192.168.1.10', port: 8443 });
		await store.probe({ host: 'console.local', port: 443 });

		expect(post).toHaveBeenCalledWith('/plugins/devices-unifi-protect/discovery/probe', {
			body: { data: { host: '192.168.1.10', port: 8443 } },
			signal: expect.any(AbortSignal),
		});
		expect(Object.keys(store.probes).sort()).toEqual(['192.168.1.10:443', '192.168.1.10:8443', 'console.local:443']);
		expect(store.probes['192.168.1.10:8443'].port).toBe(8443);
	});

	it('finds a probe by the typed host regardless of case and whitespace', async () => {
		post.mockResolvedValue({ data: { data: probeBody({ host: 'console.local', port: 443 }) }, response: { status: 200 } });
		const store = useProtectDiscovery();

		await store.probe({ host: '  Console.Local ' });

		expect(store.probes[protectProbeKey('  Console.Local ', 443)]).toBeDefined();
		expect(protectProbeKey(' CONSOLE.local')).toBe('console.local:443');
	});

	it('tracks in-flight probes per host and port', async () => {
		const resolvers: Record<string, () => void> = {};
		post.mockImplementation(
			(_path: string, options: { body: { data: { host: string } } }) =>
				new Promise((resolve) => {
					resolvers[options.body.data.host] = () =>
						resolve({ data: { data: probeBody({ host: options.body.data.host }) }, response: { status: 200 } });
				})
		);
		const store = useProtectDiscovery();

		const a = store.probe({ host: '192.168.1.10' });
		const b = store.probe({ host: '192.168.1.11', port: 8443 });

		expect(store.isProbing('192.168.1.10')).toBe(true);
		expect(store.isProbing('192.168.1.11', 8443)).toBe(true);
		expect(store.isProbing('192.168.1.11')).toBe(false);

		resolvers['192.168.1.10']();
		await a;

		expect(store.isProbing('192.168.1.10')).toBe(false);
		expect(store.isProbing('192.168.1.11', 8443)).toBe(true);

		resolvers['192.168.1.11']();
		await b;

		expect(store.isProbing('192.168.1.11', 8443)).toBe(false);
	});

	it('times out a probe at its deadline', async () => {
		post.mockImplementation(hangUntilAborted);
		const store = useProtectDiscovery();

		const pending = store.probe({ host: '192.168.1.10' });
		const assertion = expect(pending).rejects.toBeInstanceOf(ProtectTimeoutException);
		await vi.advanceTimersByTimeAsync(PROTECT_PROBE_DEADLINE_MS);
		await assertion;

		expect(store.probes).toEqual({});
	});
});
