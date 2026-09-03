import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventType } from '../remote-access.constants';
import { RemoteAccessApiException, RemoteAccessValidationException } from '../remote-access.exceptions';

import { useRemoteAccessStatus } from './remote-access-status.store';

const mockStatusRes = {
	enabled: true,
	providers: [
		{
			type: 'remote-access-tailscale',
			kind: 'mesh',
			capabilities: { https: true, public_url: false, identity_headers: false, ssh: true },
			state: 'connected',
			endpoints: [],
			message: null,
			details: {},
			proxy_addresses: [],
			advisories: [],
			updated_at: '2026-01-01T00:00:00.000Z',
		},
	],
	urls: {
		internal: 'http://localhost:3000',
		candidates: [],
		external: [],
		primary: null,
	},
	advisories: [],
};

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			warn: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('RemoteAccessStatus Store', () => {
	let store: ReturnType<typeof useRemoteAccessStatus>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useRemoteAccessStatus();

		vi.clearAllMocks();
	});

	describe('state', () => {
		it('has an empty initial state', () => {
			expect(store.data).toBeNull();
			expect(store.firstLoad).toBe(false);
			expect(store.semaphore.getting).toBe(false);
			expect(store.isLoaded()).toBe(false);
		});
	});

	describe('get', () => {
		it('fetches the status from the API', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get();

			expect(result.enabled).toBe(true);
			expect(result.providers).toHaveLength(1);
			expect(store.firstLoad).toBe(true);
			expect(store.isLoaded()).toBe(true);
			expect(backendClient.GET).toHaveBeenCalledWith('/modules/remote-access/status');
		});

		it('throws on API failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.get()).rejects.toThrow(RemoteAccessApiException);
		});

		it('deduplicates concurrent get requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			const [result1, result2] = await Promise.all([store.get(), store.get()]);

			expect(result1.enabled).toBe(true);
			expect(result2.enabled).toBe(true);
			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});

		// Regression: the request used to run outside the `try`/`finally`, so a rejection from
		// `backend.client.GET` itself (as opposed to an HTTP error response, which openapi-fetch
		// resolves into `{ error }`) left `semaphore.getting` stuck `true` forever.
		it('clears getting when the request itself rejects, so a retry is possible', async () => {
			(backendClient.GET as Mock).mockRejectedValueOnce(new Error('network down'));

			await expect(store.get()).rejects.toThrow('network down');
			expect(store.semaphore.getting).toBe(false);

			(backendClient.GET as Mock).mockResolvedValueOnce({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get();

			expect(result.enabled).toBe(true);
			expect(store.semaphore.getting).toBe(false);
		});

		// Regression: `ref()` reuses the same reactive proxy for repeated calls with an identical raw
		// object, so a module-level `defaultSemaphore` object shared by every `useRemoteAccessStatus(pinia)`
		// setup call made one store's in-flight `get()` flip `getting` to `true` for every other store too.
		it('does not share semaphore state between different Pinia instances', () => {
			const piniaA = createPinia();
			const piniaB = createPinia();

			const storeA = useRemoteAccessStatus(piniaA);
			const storeB = useRemoteAccessStatus(piniaB);

			(backendClient.GET as Mock).mockImplementation(() => new Promise(() => {}));

			void storeA.get();

			expect(storeA.semaphore.getting).toBe(true);
			expect(storeB.semaphore.getting).toBe(false);
		});
	});

	describe('set', () => {
		it('validates and stores camelCase status data directly', () => {
			const camelStatus = {
				enabled: true,
				providers: [],
				urls: { internal: 'http://localhost:3000', candidates: [], external: [], primary: null },
				advisories: [],
			};

			const result = store.set({ data: camelStatus });

			expect(result).toEqual(camelStatus);
			expect(store.data).toEqual(camelStatus);
		});

		it('throws a validation exception for malformed data', () => {
			expect(() => store.set({ data: { enabled: 'not-a-boolean' } })).toThrow(RemoteAccessValidationException);
		});
	});

	describe('onEvent', () => {
		it('ignores an event received before the initial fetch', () => {
			const result = store.onEvent({
				event: EventType.PROVIDER_STATUS,
				data: { type: 'remote-access-tailscale', state: 'connected' },
			});

			expect(result).toBeNull();
			expect(store.data).toBeNull();
		});

		it('merges a provider status event into the loaded status', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			await store.get();

			const result = store.onEvent({
				event: EventType.PROVIDER_STATUS,
				data: {
					type: 'remote-access-tailscale',
					state: 'error',
					endpoints: [],
					message: 'Daemon stopped',
					details: {},
					proxyAddresses: [],
					advisories: [],
					updatedAt: '2026-01-02T00:00:00.000Z',
				},
			});

			expect(result?.providers[0]).toMatchObject({ state: 'error', message: 'Daemon stopped' });
			expect(store.data?.providers[0]).toMatchObject({ state: 'error' });
		});

		it('merges a URLs changed event into the loaded status', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			await store.get();

			const result = store.onEvent({
				event: EventType.URLS_CHANGED,
				data: {
					internal: 'http://localhost:3000',
					external: [{ url: 'https://panel.example.com', scope: 'public', https: true, label: 'Manual external URL' }],
					primaryExternalUrl: 'https://panel.example.com',
				},
			});

			expect(result?.urls.primary).toBe('https://panel.example.com');
			expect(store.data?.urls.primary).toBe('https://panel.example.com');
		});

		it('ignores an unhandled event type without throwing', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockStatusRes },
				error: undefined,
				response: { status: 200 },
			});

			await store.get();

			const before = store.data;
			const result = store.onEvent({ event: 'RemoteAccessModule.Setup.Progress', data: {} });

			expect(result).toEqual(before);
		});
	});
});
