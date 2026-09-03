import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';

import { useTailscaleStatusStore } from './tailscale-status.store';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			warn: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Sanitized Tailscale request failure',
	};
});

const statusFields = {
	type: 'remote-access-tailscale-plugin',
	state: 'connected',
	endpoints: [{ url: 'http://100.64.0.1:3000', scope: 'private', https: false, label: 'Tailscale IPv4' }],
	message: null,
	details: { tailnet: 'example.ts.net', dns_name: 'panel.example.ts.net', ipv4: '100.64.0.1', ipv6: null, version: '1.78.1' },
	proxy_addresses: [],
	advisories: [],
	updated_at: '2026-01-01T00:00:00.000Z',
	requirements: [{ code: 'binary-installed', satisfied: true, message: 'Tailscale 1.78.1 is installed.' }],
};

describe('Tailscale status store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('starts with no status and no setup progress', () => {
		const store = useTailscaleStatusStore();

		expect(store.data).toBeNull();
		expect(store.setupProgress).toBeNull();
		expect(store.firstLoadFinished()).toBe(false);
		expect(store.isLoaded()).toBe(false);
	});

	describe('get()', () => {
		it('loads and normalizes the node status from the (correctly enveloped) GET /status response', async () => {
			get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
			const store = useTailscaleStatusStore();

			const status = await store.get();

			expect(get).toHaveBeenCalledWith('/plugins/remote-access-tailscale/status');
			expect(status.state).toBe('connected');
			expect(status.details.tailnet).toBe('example.ts.net');
			expect(status.requirements).toHaveLength(1);
			expect(store.data).toEqual(status);
			expect(store.firstLoadFinished()).toBe(true);
		});

		it('throws a sanitized exception on a failed request and clears the getting flag', async () => {
			get.mockResolvedValue({ error: { error: { details: null } }, response: { status: 503 } });
			const store = useTailscaleStatusStore();

			await expect(store.get()).rejects.toEqual(
				expect.objectContaining<Partial<RemoteAccessTailscaleApiException>>({
					message: 'Sanitized Tailscale request failure',
					code: 503,
				})
			);
			expect(store.semaphore.getting).toBe(false);
		});

		it('coalesces concurrent calls into a single request', async () => {
			let resolveGet: ((value: unknown) => void) | undefined;
			get.mockReturnValue(
				new Promise((resolve) => {
					resolveGet = resolve;
				})
			);
			const store = useTailscaleStatusStore();

			const first = store.get();
			const second = store.get();

			resolveGet?.({ data: { data: statusFields }, response: { status: 200 } });

			await Promise.all([first, second]);

			expect(get).toHaveBeenCalledTimes(1);
		});
	});

	describe('install()', () => {
		it('returns the job id from the enveloped POST /install response', async () => {
			post.mockResolvedValue({ data: { data: { job: 'job-123' } }, response: { status: 202 } });
			const store = useTailscaleStatusStore();

			const result = await store.install();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/install');
			expect(result).toEqual({ job: 'job-123' });
			// `install()` never carries endpoints/details/requirements - it must not clobber `data`.
			expect(store.data).toBeNull();
		});
	});

	describe('login()', () => {
		it('sends the auth key once and never assigns it to store state', async () => {
			post.mockResolvedValue({ data: { data: { state: 'connected' } }, response: { status: 200 } });
			const store = useTailscaleStatusStore();

			const result = await store.login('tskey-auth-secret');

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/login', { body: { auth_key: 'tskey-auth-secret' } });
			expect(result.state).toBe('connected');
			expect(JSON.stringify(store.$state)).not.toContain('tskey-auth-secret');
			expect(JSON.stringify(store.$state)).not.toContain('auth_key');
		});

		it('omits auth_key entirely from the request body when signing in interactively', async () => {
			post.mockResolvedValue({
				data: { data: { state: 'pending-auth', auth_url: 'https://login.tailscale.com/a/x', qr: 'data:image/png;base64,x' } },
				response: { status: 200 },
			});
			const store = useTailscaleStatusStore();

			await store.login();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/login', { body: {} });
		});

		it('merges the login result into an already-loaded status without touching endpoints/requirements', async () => {
			get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
			const store = useTailscaleStatusStore();
			await store.get();

			post.mockResolvedValue({
				data: { data: { state: 'pending-auth', auth_url: 'https://login.tailscale.com/a/x', qr: 'data:image/png;base64,x' } },
				response: { status: 200 },
			});

			await store.login();

			expect(store.data?.state).toBe('pending-auth');
			expect(store.data?.authUrl).toBe('https://login.tailscale.com/a/x');
			expect(store.data?.qr).toBe('data:image/png;base64,x');
			expect(store.data?.requirements).toHaveLength(1);
			expect(store.data?.endpoints).toEqual(statusFields.endpoints.map((endpoint) => expect.objectContaining({ url: endpoint.url })));
		});
	});

	describe('logout() and resetPreferences()', () => {
		it('logout() replaces the loaded status from the enveloped response', async () => {
			post.mockResolvedValue({
				data: { data: { ...statusFields, state: 'setup-required', message: 'Tailscale needs to sign in again.' } },
				response: { status: 200 },
			});
			const store = useTailscaleStatusStore();

			const status = await store.logout();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/logout');
			expect(status.state).toBe('setup-required');
			expect(store.data).toEqual(status);
		});

		it('resetPreferences() replaces the loaded status from the enveloped response', async () => {
			post.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
			const store = useTailscaleStatusStore();

			const status = await store.resetPreferences();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/reset-preferences');
			expect(status.state).toBe('connected');
		});
	});

	describe('onEvent()', () => {
		it('ignores a provider status event before the initial fetch', () => {
			const store = useTailscaleStatusStore();

			store.onEvent({ event: 'RemoteAccessModule.Provider.Status', data: { type: 'remote-access-tailscale-plugin', state: 'connected' } });

			expect(store.data).toBeNull();
		});

		it('merges a provider status event into an already-loaded status and clears a stale auth URL once connected', async () => {
			get.mockResolvedValue({
				data: { data: { ...statusFields, state: 'pending-auth', auth_url: 'https://login.tailscale.com/a/x', qr: 'data:image/png;base64,x' } },
				response: { status: 200 },
			});
			const store = useTailscaleStatusStore();
			await store.get();

			store.onEvent({
				event: 'RemoteAccessModule.Provider.Status',
				data: {
					type: 'remote-access-tailscale-plugin',
					state: 'connected',
					endpoints: statusFields.endpoints,
					message: null,
					details: statusFields.details,
					proxyAddresses: [],
					advisories: [],
					updatedAt: '2026-01-01T00:05:00.000Z',
				},
			});

			expect(store.data?.state).toBe('connected');
			expect(store.data?.authUrl).toBeUndefined();
			expect(store.data?.qr).toBeUndefined();
			// The event never carries requirements - the ones from the last REST fetch must survive.
			expect(store.data?.requirements).toHaveLength(1);
		});

		it('records a setup progress event regardless of whether a status has been fetched yet', () => {
			const store = useTailscaleStatusStore();

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: {
					type: 'remote-access-tailscale-plugin',
					job: 'job-123',
					step: 'install-package',
					state: 'running',
					message: 'Installing tailscale...',
				},
			});

			expect(store.setupProgress).toEqual({
				type: 'remote-access-tailscale-plugin',
				job: 'job-123',
				step: 'install-package',
				state: 'running',
				message: 'Installing tailscale...',
			});
		});

		it('updates setup progress across successive ticks up to a terminal state', () => {
			const store = useTailscaleStatusStore();

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: { type: 'remote-access-tailscale-plugin', job: 'job-123', state: 'running' },
			});
			expect(store.setupProgress?.state).toBe('running');

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: { type: 'remote-access-tailscale-plugin', job: 'job-123', state: 'complete' },
			});
			expect(store.setupProgress?.state).toBe('complete');
		});
	});

	it('refresh() delegates to get()', async () => {
		get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
		const store = useTailscaleStatusStore();

		await store.refresh();

		expect(get).toHaveBeenCalledTimes(1);
	});
});
