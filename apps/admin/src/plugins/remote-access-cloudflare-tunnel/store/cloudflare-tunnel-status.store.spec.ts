import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';

import { useCloudflareTunnelStatusStore } from './cloudflare-tunnel-status.store';

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
		getErrorReason: () => 'Sanitized Cloudflare Tunnel request failure',
		getErrorCode: (error: { error?: { details?: { code?: string } } }) => error?.error?.details?.code ?? null,
	};
});

const statusFields = {
	type: 'remote-access-cloudflare-tunnel-plugin',
	state: 'connected',
	endpoints: [{ url: 'https://panel.example.com', scope: 'public', https: true, label: 'Cloudflare Tunnel' }],
	message: null,
	details: { hostname: 'panel.example.com', connector_id: 'abc123', ready_connections: 4, version: '2024.6.1' },
	proxy_addresses: [],
	advisories: [],
	updated_at: '2026-01-01T00:00:00.000Z',
	requirements: [{ code: 'binary-installed', satisfied: true, message: 'cloudflared 2024.6.1 is installed.', remedy: null }],
	// `null` (not omitted) is exactly what the real backend sends before any privileged setup job
	// has ever run in this process - see the note on `CloudflareTunnelStatusSchema.setup`.
	setup: null,
	privileged_setup: { available: true, reason: null },
};

describe('Cloudflare Tunnel status store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('starts with no status and no setup progress', () => {
		const store = useCloudflareTunnelStatusStore();

		expect(store.data).toBeNull();
		expect(store.setupProgress).toBeNull();
		expect(store.firstLoadFinished()).toBe(false);
		expect(store.isLoaded()).toBe(false);
	});

	describe('get()', () => {
		it('loads and normalizes the tunnel status from the (correctly enveloped) GET /status response', async () => {
			get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
			const store = useCloudflareTunnelStatusStore();

			const status = await store.get();

			expect(get).toHaveBeenCalledWith('/plugins/remote-access-cloudflare-tunnel/status');
			expect(status.state).toBe('connected');
			expect(status.details.hostname).toBe('panel.example.com');
			expect(status.requirements).toHaveLength(1);
			// `setup: null` (the real shape before any privileged setup job has ever run) must parse
			// successfully, not throw a validation exception - regression coverage mirroring the
			// Tailscale plugin's own `.nullable()` fix.
			expect(status.setup).toBeNull();
			expect(store.data).toEqual(status);
			expect(store.firstLoadFinished()).toBe(true);
		});

		it('parses a fresh, never-installed tunnel status with null message/details', async () => {
			get.mockResolvedValue({
				data: {
					data: {
						...statusFields,
						state: 'not-installed',
						message: 'cloudflared is not installed.',
						details: { hostname: null, connector_id: null, ready_connections: null, version: null },
						requirements: [
							{
								code: 'binary-installed',
								satisfied: false,
								message: 'cloudflared is not installed.',
								remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null },
							},
						],
					},
				},
				response: { status: 200 },
			});
			const store = useCloudflareTunnelStatusStore();

			const status = await store.get();

			expect(status.state).toBe('not-installed');
			expect(status.details.hostname).toBeNull();
			expect(status.requirements[0].remedy).toEqual({ commands: ['sudo apt-get install -y cloudflared'], note: null });
		});

		it('throws a sanitized exception on a failed request and clears the getting flag', async () => {
			get.mockResolvedValue({ error: { error: { details: null } }, response: { status: 503 } });
			const store = useCloudflareTunnelStatusStore();

			await expect(store.get()).rejects.toEqual(
				expect.objectContaining<Partial<RemoteAccessCloudflareTunnelApiException>>({
					message: 'Sanitized Cloudflare Tunnel request failure',
					code: 503,
					errorCode: null,
				})
			);
			expect(store.semaphore.getting).toBe(false);
		});

		it('threads the application error code from a 422 response through to the thrown exception', async () => {
			get.mockResolvedValue({ error: { error: { details: { code: 'platform-unsupported', reason: 'x' } } }, response: { status: 422 } });
			const store = useCloudflareTunnelStatusStore();

			await expect(store.get()).rejects.toEqual(
				expect.objectContaining<Partial<RemoteAccessCloudflareTunnelApiException>>({
					code: 422,
					errorCode: 'platform-unsupported',
				})
			);
		});

		it('coalesces concurrent calls into a single request', async () => {
			let resolveGet: ((value: unknown) => void) | undefined;
			get.mockReturnValue(
				new Promise((resolve) => {
					resolveGet = resolve;
				})
			);
			const store = useCloudflareTunnelStatusStore();

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
			const store = useCloudflareTunnelStatusStore();

			const result = await store.install();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-cloudflare-tunnel/install');
			expect(result).toEqual({ job: 'job-123' });
			// `install()` never carries endpoints/details/requirements - it must not clobber `data`.
			expect(store.data).toBeNull();
		});

		it('threads the 422 application error code (e.g. privileged-worker-unavailable) through to the thrown exception', async () => {
			post.mockResolvedValue({
				error: { error: { details: { code: 'privileged-worker-unavailable', reason: 'Privileged jobs are currently unavailable.' } } },
				response: { status: 422 },
			});
			const store = useCloudflareTunnelStatusStore();

			await expect(store.install()).rejects.toEqual(
				expect.objectContaining<Partial<RemoteAccessCloudflareTunnelApiException>>({
					code: 422,
					errorCode: 'privileged-worker-unavailable',
				})
			);
		});
	});

	describe('reset()', () => {
		it('replaces the loaded status from the enveloped response', async () => {
			post.mockResolvedValue({
				data: { data: { ...statusFields, state: 'setup-required', message: 'Paste the tunnel token from the Cloudflare Zero Trust dashboard' } },
				response: { status: 200 },
			});
			const store = useCloudflareTunnelStatusStore();

			const status = await store.reset();

			expect(post).toHaveBeenCalledWith('/plugins/remote-access-cloudflare-tunnel/reset');
			expect(status.state).toBe('setup-required');
			expect(store.data).toEqual(status);
		});

		it('throws a sanitized exception on a failed request and clears the resetting flag', async () => {
			post.mockResolvedValue({ error: { error: { details: null } }, response: { status: 500 } });
			const store = useCloudflareTunnelStatusStore();

			await expect(store.reset()).rejects.toBeInstanceOf(RemoteAccessCloudflareTunnelApiException);
			expect(store.semaphore.resetting).toBe(false);
		});
	});

	describe('onEvent()', () => {
		it('ignores a provider status event before the initial fetch', () => {
			const store = useCloudflareTunnelStatusStore();

			store.onEvent({ event: 'RemoteAccessModule.Provider.Status', data: { type: 'remote-access-cloudflare-tunnel-plugin', state: 'connected' } });

			expect(store.data).toBeNull();
		});

		it('merges a provider status event into an already-loaded status without touching requirements', async () => {
			get.mockResolvedValue({ data: { data: { ...statusFields, state: 'connecting' } }, response: { status: 200 } });
			const store = useCloudflareTunnelStatusStore();
			await store.get();

			store.onEvent({
				event: 'RemoteAccessModule.Provider.Status',
				data: {
					type: 'remote-access-cloudflare-tunnel-plugin',
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
			// The event never carries requirements - the ones from the last REST fetch must survive.
			expect(store.data?.requirements).toHaveLength(1);
		});

		it('reports disconnected with no endpoints once the service is stopped', async () => {
			get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
			const store = useCloudflareTunnelStatusStore();
			await store.get();

			store.onEvent({
				event: 'RemoteAccessModule.Provider.Status',
				data: {
					type: 'remote-access-cloudflare-tunnel-plugin',
					state: 'disconnected',
					endpoints: [],
					message: 'The tunnel service is stopped.',
					details: statusFields.details,
					proxyAddresses: [],
					advisories: [],
					updatedAt: '2026-01-01T00:06:00.000Z',
				},
			});

			expect(store.data?.state).toBe('disconnected');
			expect(store.data?.endpoints).toEqual([]);
		});

		it('records a setup progress event regardless of whether a status has been fetched yet', () => {
			const store = useCloudflareTunnelStatusStore();

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: {
					type: 'remote-access-cloudflare-tunnel-plugin',
					job: 'job-123',
					step: 'install-package',
					state: 'running',
					message: 'Installing cloudflared...',
				},
			});

			expect(store.setupProgress).toEqual({
				type: 'remote-access-cloudflare-tunnel-plugin',
				job: 'job-123',
				step: 'install-package',
				state: 'running',
				message: 'Installing cloudflared...',
			});
		});

		it('updates setup progress across successive ticks up to a terminal state', () => {
			const store = useCloudflareTunnelStatusStore();

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: { type: 'remote-access-cloudflare-tunnel-plugin', job: 'job-123', state: 'running' },
			});
			expect(store.setupProgress?.state).toBe('running');

			store.onEvent({
				event: 'RemoteAccessModule.Setup.Progress',
				data: { type: 'remote-access-cloudflare-tunnel-plugin', job: 'job-123', state: 'complete' },
			});
			expect(store.setupProgress?.state).toBe('complete');
		});
	});

	it('refresh() delegates to get()', async () => {
		get.mockResolvedValue({ data: { data: statusFields }, response: { status: 200 } });
		const store = useCloudflareTunnelStatusStore();

		await store.refresh();

		expect(get).toHaveBeenCalledTimes(1);
	});
});
