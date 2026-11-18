import { createApp } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { createConsola } from 'consola';
import createClient from 'openapi-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideBackendClient } from '../../common/services/backend';
import { provideLogger } from '../../common/services/logger';
import {
	ExtensionsModuleServiceState,
	type OpenApiPaths,
	RemoteAccessModuleProviderState,
	RemoteAccessTailscalePluginAuthentication,
	RemoteAccessTailscalePluginControlAction,
	UsersModuleUserRole,
} from '../../openapi.constants';
import { resolveTailscaleProviderActions } from '../../plugins/remote-access-tailscale/utils/provider-actions';

import { ACCESS_TOKEN_COOKIE_NAME, AccessTokenType, REFRESH_TOKEN_COOKIE_NAME } from './auth.constants';
import { createSessionMiddleware } from './auth.middleware';
import { useSession } from './store/session.store';

const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock('vue3-cookies', () => ({
	useCookies: () => ({
		cookies: {
			get: (name: string) => cookieJar.get(name),
			set: (name: string, value: string) => cookieJar.set(name, value),
			remove: (name: string) => cookieJar.delete(name),
		},
	}),
}));

const LOGIN_PATH = '/modules/auth/auth/login';
const PROFILE_PATH = '/modules/auth/auth/profile';
const REFRESH_PATH = '/modules/auth/auth/refresh';
const DEVICES_PATH = '/modules/devices/devices';
const CATALOG_PATH = '/plugins/devices-virtual/producers/light-group-candidates';
const BASE_URL = 'http://localhost/api/v1';

const jwt = (expiration: number): string =>
	`${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify({ exp: expiration, sub: 'owner' }))}.signature`;

const jsonResponse = (data: unknown, status = 200): Response =>
	new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });

describe('session middleware with the real session store and HTTP client', () => {
	let client: ReturnType<typeof createClient<OpenApiPaths>>;
	let session: ReturnType<typeof useSession>;
	let requests: Request[];
	let accessToken: string;
	let refreshedAccessToken: string;
	let refreshToken: string;
	let refreshStatus: number;
	let deviceStatus: number;
	let rejectedAccessToken: string | undefined;
	let rejectAllTokens: boolean;
	let catalogBodies: unknown[];
	let onSessionExpired = vi.fn<() => void>();
	let refreshBarrier: Promise<void> | undefined;
	let deviceBarrier: Promise<void> | undefined;
	let profileBarrier: Promise<void> | undefined;
	let onDeviceRequest: (() => void) | undefined;

	const refreshRequests = (): Request[] => requests.filter((request) => request.url === BASE_URL + REFRESH_PATH);
	const deviceRequests = (): Request[] => requests.filter((request) => request.url === BASE_URL + DEVICES_PATH);
	const expireSession = (): void => {
		session.tokenPair!.accessToken = jwt(Math.floor(Date.now() / 1000) - 60);
		session.tokenPair!.expiration = new Date(Date.now() - 60_000);
	};
	const canDisconnect = (): boolean =>
		resolveTailscaleProviderActions({
			state: RemoteAccessModuleProviderState.connected,
			isOwner: session.profile?.role === UsersModuleUserRole.owner,
			isAdmin: session.profile?.role === UsersModuleUserRole.admin,
			control: {
				enabled: true,
				serviceState: ExtensionsModuleServiceState.started,
				authentication: RemoteAccessTailscalePluginAuthentication.authenticated,
				operation: null,
				availableActions: [RemoteAccessTailscalePluginControlAction.disconnect],
			},
		}).disconnect;

	beforeEach(async () => {
		requests = [];
		refreshStatus = 200;
		deviceStatus = 200;
		rejectedAccessToken = undefined;
		rejectAllTokens = false;
		catalogBodies = [];
		onSessionExpired = vi.fn<() => void>();
		refreshBarrier = undefined;
		deviceBarrier = undefined;
		profileBarrier = undefined;
		onDeviceRequest = undefined;
		cookieJar.clear();
		accessToken = jwt(Math.floor(Date.now() / 1000) + 600);
		refreshedAccessToken = jwt(Math.floor(Date.now() / 1000) + 1200);
		refreshToken = jwt(Math.floor(Date.now() / 1000) + 3600);
		cookieJar.set(ACCESS_TOKEN_COOKIE_NAME, accessToken);
		cookieJar.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

		const fetchMock = vi.fn(async (request: Request): Promise<Response> => {
			requests.push(request);

			if (request.url === BASE_URL + REFRESH_PATH || request.url === BASE_URL + LOGIN_PATH) {
				if (request.url === BASE_URL + REFRESH_PATH) await refreshBarrier;

				return jsonResponse(
					{
						access_token: refreshedAccessToken,
						refresh_token: refreshToken,
						type: AccessTokenType.BEARER,
						expiration: new Date(Date.now() + 1_200_000).toISOString(),
					},
					refreshStatus
				);
			}

			if (request.url === BASE_URL + PROFILE_PATH) {
				const result = jsonResponse({
					id:
						request.headers.get('Authorization') === `Bearer ${refreshedAccessToken}`
							? 'e74a5f58-92dc-4d67-885d-d7f6b4f5be9a'
							: 'a82d231f-8898-4a62-9295-2d3491028491',
					username: request.headers.get('Authorization') === `Bearer ${refreshedAccessToken}` ? 'other-owner' : 'owner',
					role: UsersModuleUserRole.owner,
					created_at: '2026-10-01T00:00:00Z',
				});
				if (request.headers.get('Authorization') === `Bearer ${accessToken}`) await profileBarrier;
				return result;
			}

			expect([BASE_URL + DEVICES_PATH, BASE_URL + CATALOG_PATH]).toContain(request.url);
			if (request.url === BASE_URL + CATALOG_PATH) catalogBodies.push(await request.json());
			await deviceBarrier;
			onDeviceRequest?.();
			if (rejectAllTokens || (rejectedAccessToken && request.headers.get('Authorization') === `Bearer ${rejectedAccessToken}`)) {
				return Response.json({ statusCode: 401, message: 'Token not found', error: 'Unauthorized' }, { status: 401 });
			}

			return jsonResponse([], deviceStatus);
		});

		vi.stubGlobal('fetch', fetchMock);
		client = createClient<OpenApiPaths>({ baseUrl: BASE_URL, fetch: fetchMock });
		const app = createApp({});
		const pinia = createPinia();
		setActivePinia(pinia);
		provideBackendClient(app, client);
		provideLogger(app, createConsola({ level: 0 }));
		session = app.runWithContext(() => useSession(pinia));
		client.use(createSessionMiddleware(session, onSessionExpired));
		await session.initialize();
		expect(session.isSignedIn()).toBe(true);
		expect(canDisconnect()).toBe(true);
		requests = [];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('preserves the loaded owner profile and controls during a direct expired-session refresh', async () => {
		const profile = session.profile;
		expireSession();

		await expect(session.refresh()).resolves.toBe(true);

		expect(session.profile).toBe(profile);
		expect(session.isSignedIn()).toBe(true);
		expect(canDisconnect()).toBe(true);
		expect(session.accessToken()).toBe(refreshedAccessToken);
		expect(refreshRequests()).toHaveLength(1);
		expect(refreshRequests()[0].headers.has('Authorization')).toBe(false);
		expect(await refreshRequests()[0].clone().json()).toEqual({ data: { token: refreshToken } });
	});

	it('preserves owner controls when an ordinary request refreshes an expired access token', async () => {
		const profile = session.profile;
		expireSession();

		await client.GET(DEVICES_PATH);

		expect(session.profile).toBe(profile);
		expect(canDisconnect()).toBe(true);
		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()[0].headers.get('Authorization')).toBe(`Bearer ${refreshedAccessToken}`);
	});

	it('coalesces concurrent expired-token requests into one refresh', async () => {
		expireSession();
		let releaseRefresh!: () => void;
		refreshBarrier = new Promise<void>((resolve) => {
			releaseRefresh = resolve;
		});
		const pending = Promise.all([client.GET(DEVICES_PATH), client.GET(DEVICES_PATH), client.GET(DEVICES_PATH)]);

		await vi.waitFor(() => expect(refreshRequests()).toHaveLength(1));
		expect(deviceRequests()).toHaveLength(0);
		releaseRefresh();
		await pending;

		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()).toHaveLength(3);
		expect(deviceRequests().every((request) => request.headers.get('Authorization') === `Bearer ${refreshedAccessToken}`)).toBe(true);
		expect(session.isSignedIn()).toBe(true);
		expect(canDisconnect()).toBe(true);
	});

	it('returns a rejected refresh to its caller once without recursively refreshing or retrying it', async () => {
		expireSession();
		refreshStatus = 401;

		await expect(session.refresh()).resolves.toBe(false);

		expect(refreshRequests()).toHaveLength(1);
		expect(refreshRequests()[0].headers.has('Authorization')).toBe(false);
		expect(cookieJar.has(REFRESH_TOKEN_COOKIE_NAME)).toBe(false);
	}, 1000);

	it('clears tokens and profile when the middleware refresh is rejected', async () => {
		expireSession();
		refreshStatus = 401;
		deviceStatus = 401;

		const response = await client.GET(DEVICES_PATH);

		expect(response.response.status).toBe(401);
		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()).toHaveLength(0);
		expect(session.tokenPair).toBeNull();
		expect(session.profile).toBeNull();
		expect(cookieJar.size).toBe(0);
	}, 1000);

	it('leaves an unrelated authenticated 401 unchanged when the access token is still valid', async () => {
		const profile = session.profile;
		deviceStatus = 401;

		const response = await client.GET(DEVICES_PATH);

		expect(response.response.status).toBe(401);
		expect(refreshRequests()).toHaveLength(0);
		expect(deviceRequests()).toHaveLength(1);
		expect(session.profile).toBe(profile);
		expect(session.accessToken()).toBe(accessToken);
	});

	it('refreshes and retries a request once if its token expires before a 401 response', async () => {
		deviceStatus = 401;
		rejectedAccessToken = accessToken;
		onDeviceRequest = (): void => {
			if (deviceRequests().length === 1) {
				expireSession();
			}
		};

		const response = await client.GET(DEVICES_PATH);

		expect(response.response.status).toBe(401);
		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()).toHaveLength(2);
		expect(deviceRequests()[1].headers.get('Authorization')).toBe(`Bearer ${refreshedAccessToken}`);
		expect(deviceRequests()[1].headers.get('X-Retried')).toBe('1');
		expect(session.isSignedIn()).toBe(true);
		expect(canDisconnect()).toBe(true);
	});
	it('recovers a rejected but locally unexpired token and replays the consumed catalog POST body once', async () => {
		rejectedAccessToken = accessToken;
		const body = { selected_channels: ['a', 'b'] };
		const result = await client.POST(CATALOG_PATH, { body });
		expect(result.response.status).toBe(200);
		expect(refreshRequests()).toHaveLength(1);
		expect(catalogBodies).toEqual([body, body]);
		expect(requests.filter((request) => request.url.endsWith(CATALOG_PATH))).toHaveLength(2);
		expect(session.isSignedIn()).toBe(true);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it('coalesces concurrent rejected-token responses into one refresh', async () => {
		rejectedAccessToken = accessToken;
		let release!: () => void;
		refreshBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = Promise.all([client.GET(DEVICES_PATH), client.GET(DEVICES_PATH), client.GET(DEVICES_PATH)]);
		await vi.waitFor(() => expect(refreshRequests()).toHaveLength(1));
		release();
		const results = await pending;
		expect(results.every((result) => result.response.status === 200)).toBe(true);
		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()).toHaveLength(6);
		expect(session.isSignedIn()).toBe(true);
	});

	it('reuses a newer session token when a delayed rejection belongs to the previous token', async () => {
		rejectedAccessToken = accessToken;
		onDeviceRequest = () => {
			session.tokenPair!.accessToken = refreshedAccessToken;
		};
		const result = await client.GET(DEVICES_PATH);
		expect(result.response.status).toBe(200);
		expect(refreshRequests()).toHaveLength(0);
		expect(deviceRequests()).toHaveLength(2);
		expect(deviceRequests()[1].headers.get('Authorization')).toBe(`Bearer ${refreshedAccessToken}`);
	});

	it('does not replay a delayed POST after logout and another account signs in', async () => {
		rejectedAccessToken = accessToken;
		let release!: () => void;
		deviceBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const body = { selected_channels: ['action-from-first-user'] };
		const pending = client.POST(CATALOG_PATH, { body });
		await vi.waitFor(() => expect(catalogBodies).toHaveLength(1));
		session.clear();
		await session.create({ data: { username: 'other-owner', password: 'test-password' } });
		release();
		const result = await pending;
		expect(result.response.status).toBe(401);
		expect(catalogBodies).toEqual([body]);
		expect(refreshRequests()).toHaveLength(0);
		expect(session.accessToken()).toBe(refreshedAccessToken);
		expect(session.profile?.username).toBe('other-owner');
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it('fences a new sign-in even when it replaces the existing session without an explicit logout', async () => {
		rejectedAccessToken = accessToken;
		let release!: () => void;
		deviceBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = client.GET(DEVICES_PATH);
		await vi.waitFor(() => expect(deviceRequests()).toHaveLength(1));
		await session.create({ data: { username: 'other-owner', password: 'test-password' } });
		release();
		expect((await pending).response.status).toBe(401);
		expect(deviceRequests()).toHaveLength(1);
		expect(session.profile?.username).toBe('other-owner');
	});

	it('does not restore an old profile after another account has signed in', async () => {
		let release!: () => void;
		profileBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = session.get();
		const rejected = expect(pending).rejects.toThrow('Session changed.');
		await vi.waitFor(() => expect(requests.some((request) => request.url.endsWith(PROFILE_PATH))).toBe(true));
		session.clear();
		await session.create({ data: { username: 'other-owner', password: 'test-password' } });
		release();
		await rejected;
		expect(session.profile?.username).toBe('other-owner');
		expect(session.isSignedIn()).toBe(true);
	});

	it.each([false, true])('does not let an old refresh replace a new login (preflight: %s)', async (preflight) => {
		if (preflight) expireSession();
		else rejectedAccessToken = accessToken;
		let release!: () => void;
		refreshBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = client.GET(DEVICES_PATH);
		await vi.waitFor(() => expect(refreshRequests()).toHaveLength(1));
		session.clear();
		await session.create({ data: { username: 'other-owner', password: 'test-password' } });
		const nextToken = jwt(Math.floor(Date.now() / 1000) + 2400);
		session.tokenPair!.accessToken = nextToken;
		const currentProfile = session.profile;
		release();
		expect((await pending).response.status).toBe(401);
		expect(session.accessToken()).toBe(nextToken);
		expect(session.profile).toBe(currentProfile);
		expect(session.isSignedIn()).toBe(true);
		expect(deviceRequests()).toHaveLength(preflight ? 0 : 1);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it.each([false, true])('does not retry a provider 401 after a local token change (expired: %s)', async (expired) => {
		deviceStatus = 401;
		onDeviceRequest = () => {
			if (expired) expireSession();
			else session.tokenPair!.accessToken = refreshedAccessToken;
		};
		expect((await client.GET(DEVICES_PATH)).response.status).toBe(401);
		expect(deviceRequests()).toHaveLength(1);
		expect(refreshRequests()).toHaveLength(0);
	});

	it('reports an unrecoverable session globally once for concurrent failures', async () => {
		rejectedAccessToken = accessToken;
		refreshStatus = 401;
		await Promise.all([client.GET(DEVICES_PATH), client.GET(DEVICES_PATH)]);
		expect(refreshRequests()).toHaveLength(1);
		expect(session.isSignedIn()).toBe(false);
		expect(session.tokenPair).toBeNull();
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it('stops after one retry when the renewed token is rejected too', async () => {
		rejectAllTokens = true;
		const result = await client.GET(DEVICES_PATH);
		expect(result.response.status).toBe(401);
		expect(refreshRequests()).toHaveLength(1);
		expect(deviceRequests()).toHaveLength(2);
		expect(session.tokenPair).toBeNull();
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it('does not replay a wizard request cancelled while authentication was refreshing', async () => {
		rejectedAccessToken = accessToken;
		let release!: () => void;
		refreshBarrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const controller = new AbortController();
		const pending = client.GET(DEVICES_PATH, { signal: controller.signal });
		await vi.waitFor(() => expect(refreshRequests()).toHaveLength(1));
		controller.abort();
		release();
		await pending;
		expect(deviceRequests()).toHaveLength(1);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});
});
