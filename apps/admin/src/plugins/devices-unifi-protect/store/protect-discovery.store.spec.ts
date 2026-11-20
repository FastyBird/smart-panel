import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROTECT_DISCOVERY_SCAN_DEADLINE_MS, PROTECT_PROBE_DEADLINE_MS } from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { useProtectDiscovery } from './protect-discovery.store';

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
	...overrides,
});

const discoveryBody = (overrides: Record<string, unknown> = {}) => ({
	data: {
		data: {
			status: 'completed',
			warnings: [],
			interfaces: [],
			consoles: [
				{
					mac: 'aa:bb:cc:dd:ee:ff',
					host: '192.168.1.10',
					addresses: ['192.168.1.10'],
					hostname: null,
					probe: probeBody(),
				},
			],
			otherUnifiDevices: 0,
			...overrides,
		},
	},
	response: { status: 200 },
});

const hangUntilAborted = (_path: string, options?: { signal?: AbortSignal }) =>
	new Promise((_resolve, reject) => {
		options?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
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
	});

	it('publishes the scan result', async () => {
		post.mockResolvedValue(discoveryBody({ status: 'completed', other_unifi_devices: 2 }));
		const store = useProtectDiscovery();

		await store.scan();

		expect(post).toHaveBeenCalledWith('/plugins/devices-unifi-protect/discovery/scan', expect.objectContaining({ signal: expect.any(AbortSignal) }));
		expect(store.discovery?.status).toBe('completed');
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

	it('does not re-read the cache after a scan failure that is not a timeout', async () => {
		post.mockResolvedValue({ error: { message: 'nope' }, response: { status: 500 } });
		const store = useProtectDiscovery();

		await expect(store.scan()).rejects.toBeInstanceOf(ProtectApiException);

		expect(get).not.toHaveBeenCalled();
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
