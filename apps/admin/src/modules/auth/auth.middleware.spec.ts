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

const PROFILE_PATH = '/modules/auth/auth/profile';
const REFRESH_PATH = '/modules/auth/auth/refresh';
const DEVICES_PATH = '/modules/devices/devices';
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
	let refreshBarrier: Promise<void> | undefined;
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
		refreshBarrier = undefined;
		onDeviceRequest = undefined;
		cookieJar.clear();
		accessToken = jwt(Math.floor(Date.now() / 1000) + 600);
		refreshedAccessToken = jwt(Math.floor(Date.now() / 1000) + 1200);
		refreshToken = jwt(Math.floor(Date.now() / 1000) + 3600);
		cookieJar.set(ACCESS_TOKEN_COOKIE_NAME, accessToken);
		cookieJar.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

		const fetchMock = vi.fn(async (request: Request): Promise<Response> => {
			requests.push(request);

			if (request.url === BASE_URL + REFRESH_PATH) {
				await refreshBarrier;

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
				return jsonResponse({
					id: 'a82d231f-8898-4a62-9295-2d3491028491',
					username: 'owner',
					role: UsersModuleUserRole.owner,
					created_at: '2026-10-01T00:00:00Z',
				});
			}

			expect(request.url).toBe(BASE_URL + DEVICES_PATH);
			onDeviceRequest?.();

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
		client.use(createSessionMiddleware(session));
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
		expect(deviceRequests()).toHaveLength(1);
		expect(deviceRequests()[0].headers.has('Authorization')).toBe(false);
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
});
