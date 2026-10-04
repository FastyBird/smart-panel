import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataRefreshRegistry, refreshLoadedStores } from '../../../common/services/data-refresh';
import { useCloudflareTunnelStatusStore } from '../../../plugins/remote-access-cloudflare-tunnel/store/cloudflare-tunnel-status.store';
import { useTailscaleStatusStore } from '../../../plugins/remote-access-tailscale/store/tailscale-status.store';
import { EventType } from '../remote-access.constants';

import { useRemoteAccessStatus } from './remote-access-status.store';

const client = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client }),
	useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

const deferred = () => {
	let resolve!: (value: unknown) => void;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const provider = (type: string, epoch = 'A', revision = 1, state = 'connected') => ({
	type,
	enabled: true,
	epoch,
	revision,
	state,
	endpoints: [],
	details: {},
	proxy_addresses: [],
	advisories: [],
	updated_at: '2026-01-01T00:00:00.000Z',
	requirements: [],
	setup: null,
	privileged_setup: { available: true, reason: null },
});
const response = (data: unknown) => ({ data: { data }, response: { status: 200 } });
const cases = [
	{ name: 'module', create: useRemoteAccessStatus, type: 'remote-access-tailscale', module: true },
	{ name: 'Tailscale', create: useTailscaleStatusStore, type: 'remote-access-tailscale-plugin', module: false },
	{ name: 'Cloudflare', create: useCloudflareTunnelStatusStore, type: 'remote-access-cloudflare-tunnel-plugin', module: false },
];

for (const entry of cases) {
	const snapshot = (epoch = 'A', revision = 1, state = 'connected') =>
		entry.module
			? {
					epoch,
					revision,
					enabled: true,
					providers: [
						{
							...provider(entry.type, epoch, revision, state),
							kind: 'mesh',
							capabilities: { https: true, public_url: false, identity_headers: false, ssh: false },
						},
					],
					urls: { epoch, revision, internal: 'http://local', candidates: [], external: [], primary: null },
					advisories: [],
				}
			: provider(entry.type, epoch, revision, state);
	const state = (store: ReturnType<typeof entry.create>) => {
		const data = store.data;
		return data && ('providers' in data ? data.providers[0]?.state : data.state);
	};
	describe(`${entry.name} snapshot ordering`, () => {
		beforeEach(() => {
			setActivePinia(createPinia());
			client.GET.mockReset();
			client.POST.mockReset();
		});
		it('keeps the event received during the first GET when its older response arrives', async () => {
			const pending = deferred();
			client.GET.mockReturnValue(pending.promise);
			const store = entry.create();
			const load = store.get();
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'A', 2, 'disconnected') });
			pending.resolve(response(snapshot()));
			await load;
			expect(state(store)).toBe('disconnected');
		});
		it('starts a fresh reconnect GET and ignores the earlier backend epoch response', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const old = deferred();
			const fresh = deferred();
			client.GET.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
			const load = store.get();
			const refresh = store.refresh();
			expect(client.GET).toHaveBeenCalledTimes(3);
			fresh.resolve(response(snapshot('B', 1, 'disconnected')));
			await refresh;
			old.resolve(response(snapshot('A', 99)));
			await load;
			expect(state(store)).toBe('disconnected');
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'A', 100) });
			expect(state(store)).toBe('disconnected');
		});
		it('resyncs an unknown event epoch and rejects delayed events from the retired process', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const fresh = deferred();
			client.GET.mockReturnValueOnce(fresh.promise);
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 2, 'disconnected') });
			expect(client.GET).toHaveBeenCalledTimes(2);
			expect(state(store)).toBe('connected');
			fresh.resolve(response(snapshot('B', 1, 'connecting')));
			await store.get();
			expect(state(store)).toBe('disconnected');
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'A', 100) });
			expect(state(store)).toBe('disconnected');
		});
		it('includes an initial pending load in reconnect refresh and aborts its HTTP request', async () => {
			const old = deferred();
			const fresh = deferred();
			client.GET.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
			const store = entry.create();
			const load = store.get();
			expect(store.isLoaded()).toBe(true);
			const signal = client.GET.mock.calls[0]?.[1]?.signal as AbortSignal;
			const refresh = store.refresh();
			expect(signal.aborted).toBe(true);
			fresh.resolve(response(snapshot('B', 1, 'disconnected')));
			await refresh;
			old.resolve(response(snapshot('A', 99)));
			await load;
			expect(state(store)).toBe('disconnected');
		});
		it('a second registry reconnect supersedes remote GET before an unrelated handler finishes', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const old = deferred();
			const fresh = deferred();
			const unrelated = deferred();
			client.GET.mockImplementationOnce(
				(_path, options) =>
					new Promise((_resolve, reject) => {
						options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
						old.promise.then(_resolve, reject);
					})
			).mockReturnValueOnce(fresh.promise);
			const registry = new DataRefreshRegistry();
			registry.register(Symbol('other'), async () => {
				await unrelated.promise;
			});
			registry.register(Symbol('remote'), () => refreshLoadedStores([store]), { supersedeOnReconnect: true });
			const first = registry.refreshAll();
			const second = registry.refreshAll();
			expect(client.GET).toHaveBeenCalledTimes(3);
			fresh.resolve(response(snapshot('B', 1, 'disconnected')));
			await store.get();
			expect(state(store)).toBe('disconnected');
			expect(store.semaphore.getting).toBe(false);
			unrelated.resolve(undefined);
			await Promise.all([first, second]);
			expect(client.GET).toHaveBeenCalledTimes(3);
		});
		it('coalesces unknown epoch events emitted by the resync GET itself', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			client.GET.mockImplementationOnce(async () => {
				store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 2, 'disconnected') });
				return response(snapshot('B', 2, 'disconnected'));
			});
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 1, 'connecting') });
			await store.get();
			expect(client.GET).toHaveBeenCalledTimes(2);
			expect(state(store)).toBe('disconnected');
		});
		it('retains a buffered epoch event when a second unknown epoch arrives for the same provider', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const fresh = deferred();
			client.GET.mockReturnValueOnce(fresh.promise);
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 3, 'disconnected') });
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'C', 10, 'connected') });
			fresh.resolve(response(snapshot('B', 2, 'connected')));
			await store.get();
			expect(client.GET).toHaveBeenCalledTimes(2);
			expect(state(store)).toBe('disconnected');
		});
		it('does not roll back a loaded provider when an in-flight full GET completes', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const pending = deferred();
			client.GET.mockReturnValueOnce(pending.promise);
			const load = store.get();
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'A', 3, 'disconnected') });
			pending.resolve(response(snapshot('A', 2, 'connected')));
			await load;
			expect(state(store)).toBe('disconnected');
		});
		it('resynchronizes when a new process event arrives during the first old-process GET', async () => {
			const old = deferred();
			client.GET.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(snapshot('B', 1, 'connecting')));
			const store = entry.create();
			const load = store.get();
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 2, 'disconnected') });
			old.resolve(response(snapshot('A', 99, 'connected')));
			await load;
			expect(client.GET).toHaveBeenCalledTimes(2);
			expect(state(store)).toBe('disconnected');
		});
		it('bounds multi-epoch event buffering while retaining the authoritative epoch candidate', async () => {
			client.GET.mockResolvedValueOnce(response(snapshot()));
			const store = entry.create();
			await store.get();
			const fresh = deferred();
			client.GET.mockReturnValueOnce(fresh.promise);
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'B', 3, 'disconnected') });
			for (let index = 0; index < 40; index++) {
				store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, `unknown-${index}`, 10) });
			}
			fresh.resolve(response(snapshot('B', 2)));
			await store.get();
			expect(client.GET).toHaveBeenCalledTimes(2);
			expect(state(store)).toBe('disconnected');
		});
		it('requires authoritative resync for unknown events after retired epoch history reaches its bound', async () => {
			const store = entry.create();
			for (let index = 0; index < 35; index++) {
				client.GET.mockResolvedValueOnce(response(snapshot(`epoch-${index}`, 1, 'disconnected')));
				await store.refresh();
			}
			client.GET.mockResolvedValueOnce(response(snapshot('epoch-34', 1, 'disconnected')));
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'epoch-33', 100) });
			expect(state(store)).toBe('disconnected');
			await store.get();
			expect(state(store)).toBe('disconnected');
			expect(client.GET).toHaveBeenCalledTimes(36);
		});
		it('rejects lower revisions and unversioned events after a versioned snapshot', async () => {
			client.GET.mockResolvedValue(response(snapshot('A', 4, 'disconnected')));
			const store = entry.create();
			await store.get();
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider(entry.type, 'A', 3) });
			const legacy: Record<string, unknown> = { ...provider(entry.type) };
			delete legacy.epoch;
			delete legacy.revision;
			store.onEvent({ event: EventType.PROVIDER_STATUS, data: legacy });
			expect(state(store)).toBe('disconnected');
		});
	});
}

describe('module component ordering', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		client.GET.mockReset();
	});
	it('preserves a reenabled provider against an older full snapshot omitting it', async () => {
		const initial = {
			epoch: 'A',
			revision: 1,
			enabled: true,
			providers: [{ ...provider('tailscale'), kind: 'mesh', capabilities: { https: true, public_url: false, identity_headers: false, ssh: false } }],
			urls: { epoch: 'A', revision: 1, internal: 'http://local', candidates: [], external: [], primary: null },
			advisories: [],
		};
		client.GET.mockResolvedValueOnce(response(initial));
		const store = useRemoteAccessStatus();
		await store.get();
		const stale = deferred();
		client.GET.mockReturnValueOnce(stale.promise);
		const load = store.get();
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider('tailscale', 'A', 3, 'connected') });
		stale.resolve(response({ ...initial, revision: 2, providers: [], urls: { ...initial.urls, revision: 2 } }));
		await load;
		expect(store.data?.providers[0]?.revision).toBe(3);
	});
	it('fences omitted provider membership and restores known metadata on a newer event', async () => {
		const initial = {
			epoch: 'A',
			revision: 1,
			enabled: true,
			providers: [{ ...provider('tailscale'), kind: 'mesh', capabilities: { https: true, public_url: false, identity_headers: false, ssh: false } }],
			urls: { epoch: 'A', revision: 1, internal: 'http://local', candidates: [], external: [], primary: null },
			advisories: [],
		};
		client.GET.mockResolvedValueOnce(response(initial)).mockResolvedValueOnce(
			response({ ...initial, revision: 3, providers: [], urls: { ...initial.urls, revision: 3 } })
		);
		const store = useRemoteAccessStatus();
		await store.get();
		await store.get();
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider('tailscale', 'A', 2) });
		expect(store.data?.providers).toHaveLength(0);
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider('tailscale', 'A', 4) });
		expect(store.data?.providers[0]?.revision).toBe(4);
	});
	it('keeps disabled providers pruned while accepting a later enabled publication', async () => {
		const initial = {
			epoch: 'A',
			revision: 1,
			enabled: true,
			providers: [{ ...provider('tailscale'), kind: 'mesh', capabilities: { https: true, public_url: false, identity_headers: false, ssh: false } }],
			urls: { epoch: 'A', revision: 1, internal: 'http://local', candidates: [], external: [], primary: null },
			advisories: [],
		};
		client.GET.mockResolvedValueOnce(response(initial)).mockResolvedValueOnce(
			response({ ...initial, revision: 2, providers: [], urls: { ...initial.urls, revision: 2 } })
		);
		const store = useRemoteAccessStatus();
		await store.get();
		await store.get();
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: { ...provider('tailscale', 'A', 3, 'disconnected'), enabled: false } });
		expect(store.data?.providers).toHaveLength(0);
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: { ...provider('tailscale', 'A', 4), enabled: true } });
		expect(store.data?.providers[0]?.revision).toBe(4);
	});
	it('accepts provider and URL events sharing one revision and keeps both against an older full set', async () => {
		const initial = {
			epoch: 'A',
			revision: 1,
			enabled: true,
			providers: [{ ...provider('tailscale'), kind: 'mesh', capabilities: { https: true, public_url: false, identity_headers: false, ssh: false } }],
			urls: { epoch: 'A', revision: 1, internal: 'http://local', candidates: [], external: [], primary: null },
			advisories: [],
		};
		client.GET.mockResolvedValue(response(initial));
		const store = useRemoteAccessStatus();
		await store.get();
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider('tailscale', 'A', 2, 'disconnected') });
		store.onEvent({
			event: EventType.URLS_CHANGED,
			data: { epoch: 'A', revision: 2, internal: 'http://new-local', external: [], primaryExternalUrl: null },
		});
		const stale = JSON.parse(JSON.stringify(store.data!));
		stale.revision = 1;
		stale.providers[0]!.revision = 1;
		stale.providers[0]!.state = 'connected';
		stale.urls.revision = 1;
		stale.urls.internal = 'http://old-local';
		store.set({ data: stale });
		expect(store.data?.providers[0]?.state).toBe('disconnected');
		expect(store.data?.urls.internal).toBe('http://new-local');
	});
});

describe('Tailscale authentication ordering', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		client.GET.mockReset();
		client.POST.mockReset();
	});
	it('returns a successful login result when the followup status resync fails', async () => {
		client.GET.mockResolvedValueOnce(response(provider('remote-access-tailscale-plugin', 'A', 1, 'disconnected'))).mockRejectedValueOnce(
			new Error('Network unavailable')
		);
		client.POST.mockResolvedValueOnce(response({ state: 'pending-auth', auth_url: 'https://login.tailscale.com/current' }));
		const store = useTailscaleStatusStore();
		await store.get();
		await expect(store.login()).resolves.toMatchObject({ state: 'pending-auth', authUrl: 'https://login.tailscale.com/current' });
		expect(store.data?.state).toBe('disconnected');
		expect(store.data?.authUrl).toBeUndefined();
		expect(store.semaphore.getting).toBe(false);
	});
	it('fences a pending login against a newer full provider snapshot', async () => {
		client.GET.mockResolvedValueOnce(response(provider('remote-access-tailscale-plugin', 'A', 1, 'pending-auth'))).mockResolvedValueOnce(
			response(provider('remote-access-tailscale-plugin', 'A', 3, 'disconnected'))
		);
		const store = useTailscaleStatusStore();
		await store.get();
		const pending = deferred();
		client.POST.mockReturnValueOnce(pending.promise);
		const login = store.login();
		await store.get();
		pending.resolve(response({ state: 'pending-auth', auth_url: 'https://login.tailscale.com/stale' }));
		await login;
		expect(store.data?.state).toBe('disconnected');
		expect(store.data?.authUrl).toBeUndefined();
		expect(client.GET).toHaveBeenCalledTimes(2);
	});
	it('does not restore a login capability URL after a newer disconnected event', async () => {
		client.GET.mockResolvedValue(response(provider('remote-access-tailscale-plugin', 'A', 1, 'pending-auth')));
		const store = useTailscaleStatusStore();
		await store.get();
		const pending = deferred();
		client.POST.mockReturnValue(pending.promise);
		const login = store.login();
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: provider('remote-access-tailscale-plugin', 'A', 2, 'disconnected') });
		pending.resolve(response({ state: 'pending-auth', auth_url: 'https://login.tailscale.com/old' }));
		await login;
		expect(store.data?.state).toBe('disconnected');
		expect(store.data?.authUrl).toBeUndefined();
	});
});
