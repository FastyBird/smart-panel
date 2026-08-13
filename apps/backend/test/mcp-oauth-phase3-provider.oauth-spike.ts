import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import type Provider from 'oidc-provider';
import { DataSource } from 'typeorm';

import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRefreshFamilyLineageEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
	McpOAuthServerStateEntity,
} from '../src/modules/mcp/entities/mcp-oauth.entity';
import { MCP_OAUTH_SERVER_STATE_KEY, McpOAuthScope } from '../src/modules/mcp/mcp.constants';
import {
	type McpOAuthProviderAdapterOptions,
	createMcpOAuthProviderAdapter,
} from '../src/modules/mcp/oauth/mcp-oauth-provider.adapter';
import { McpOAuthProviderFactory } from '../src/modules/mcp/oauth/mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from '../src/modules/mcp/oauth/mcp-oauth.types';
import { McpOAuthClientService } from '../src/modules/mcp/services/mcp-oauth-client.service';
import { McpOAuthEndpointRateLimitService } from '../src/modules/mcp/services/mcp-oauth-endpoint-rate-limit.service';
import { McpOAuthInteractionService } from '../src/modules/mcp/services/mcp-oauth-interaction.service';
import { McpOAuthProviderMaterialService } from '../src/modules/mcp/services/mcp-oauth-provider-material.service';
import { McpOAuthPublicUrlService } from '../src/modules/mcp/services/mcp-oauth-public-url.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../src/modules/mcp/services/mcp-oauth-runtime.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { UserEntity } from '../src/modules/users/entities/users.entity';
import { UserLanguage, UserRole } from '../src/modules/users/users.constants';

import { runMcpOAuthHandlerInvalidationRaces } from './support/mcp-oauth-handler-invalidation-races';

jest.mock('../src/modules/mcp/services/mcp-installation.service', () => ({ McpInstallationService: class {} }));

const CLIENT_ID = 'phase3-public-client';
const ACCOUNT_ID = 'owner-1';
const REGISTERED_REDIRECT_URI = 'http://127.0.0.1:1455/callback';
let consentPromptCount = 0;
let persistSmartPanelGrant = (_providerGrantId: string): Promise<void> => Promise.resolve();
let artifactLifecycleHook: NonNullable<McpOAuthProviderAdapterOptions['artifactLifecycleHook']> = () =>
	Promise.resolve();
let denyNextConsent = false;
let deniedInteraction: { uid: string; cookie: string; url: string } | undefined;
let interactionService: McpOAuthInteractionService | undefined;

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

class CookieBrowser {
	private readonly cookies = new Map<string, string>();

	async fetch(url: URL, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);

		if (this.cookies.size > 0) {
			headers.set('cookie', [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '));
		}

		const response = await fetch(url, { ...init, headers, redirect: 'manual' });

		for (const cookie of response.headers.getSetCookie()) {
			const [nameValue] = cookie.split(';', 1);
			const separator = nameValue.indexOf('=');

			this.cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
		}

		return response;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const createBarrier = (participants: number): (() => Promise<void>) => {
	let arrivals = 0;
	let release = (): void => undefined;
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});

	return async (): Promise<void> => {
		arrivals += 1;

		if (arrivals === participants) release();
		await released;
	};
};

const finishInteraction = async (
	provider: Provider,
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> => {
	const details = await provider.interactionDetails(request, response);

	if (details.prompt.name === 'login') {
		await provider.interactionFinished(
			request,
			response,
			{ login: { accountId: ACCOUNT_ID, acr: 'smart-panel-session', amr: ['pwd'] } },
			{ mergeWithLastSubmission: false },
		);
		return;
	}

	if (details.prompt.name !== 'consent' || typeof details.params.client_id !== 'string') {
		throw new Error(`Unexpected OAuth interaction prompt: ${details.prompt.name}`);
	}
	consentPromptCount += 1;

	if (denyNextConsent) {
		denyNextConsent = false;

		if (!interactionService) throw new Error('The production OAuth interaction service is unavailable');

		deniedInteraction = {
			uid: details.uid,
			cookie: request.headers.cookie ?? '',
			url: request.url ?? '',
		};
		const completion = await interactionService.deny(details.uid, ACCOUNT_ID, request);

		response.statusCode = 303;
		response.setHeader('location', completion.redirectTo);
		if (completion.setCookies.length > 0) response.setHeader('set-cookie', completion.setCookies);
		response.end();
		return;
	}

	let grant = details.grantId === undefined ? undefined : await provider.Grant.find(details.grantId);
	grant ??= new provider.Grant({ accountId: ACCOUNT_ID, clientId: details.params.client_id });
	const promptDetails = isRecord(details.prompt.details) ? details.prompt.details : {};
	const missingResourceScopes = promptDetails.missingResourceScopes;

	if (isRecord(missingResourceScopes)) {
		for (const [resource, scopes] of Object.entries(missingResourceScopes)) {
			if (isStringArray(scopes)) grant.addResourceScope(resource, scopes.join(' '));
		}
	}

	const missingOidcScope = promptDetails.missingOIDCScope;

	if (isStringArray(missingOidcScope)) grant.addOIDCScope(missingOidcScope.join(' '));

	const grantId = await grant.save();
	await persistSmartPanelGrant(grantId);
	await provider.interactionFinished(
		request,
		response,
		{ consent: details.grantId === undefined ? { grantId } : {} },
		{ mergeWithLastSubmission: true },
	);
};

describe('MCP OAuth Phase 3 provider runtime', () => {
	let dataSource: DataSource;
	let server: ReturnType<typeof createServer>;
	let provider: Provider;
	let factory: McpOAuthProviderFactory;
	let origin: string;
	let urls: McpOAuthPublicUrls;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpOAuthApproverAuthorityEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthInteractionEntity,
				McpOAuthProviderArtifactEntity,
				McpOAuthProviderRefreshFamilyLineageEntity,
				McpOAuthProviderRevokedGrantEntity,
				McpOAuthProviderRevokedRefreshFamilyEntity,
				McpOAuthServerStateEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();

		server = createServer();
		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		urls = {
			publicBaseUrl: origin,
			resource: `${origin}/api/v1/modules/mcp`,
			protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource/api/v1/modules/mcp`,
			issuer: `${origin}/api/v1/modules/mcp/oauth`,
			authorizationServerMetadata: `${origin}/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth`,
			authorizationEndpoint: `${origin}/api/v1/modules/mcp/oauth/authorize`,
			tokenEndpoint: `${origin}/api/v1/modules/mcp/oauth/token`,
			revocationEndpoint: `${origin}/api/v1/modules/mcp/oauth/token/revocation`,
		};
		const user = await dataSource.getRepository(UserEntity).save({
			id: ACCOUNT_ID,
			username: 'owner',
			password: null,
			email: null,
			firstName: null,
			lastName: null,
			role: UserRole.OWNER,
			language: UserLanguage.EN,
			isHidden: false,
		});
		const client = await dataSource.getRepository(McpOAuthClientEntity).save({
			clientIdentifier: CLIENT_ID,
			name: 'Phase 3 public client',
			redirectUris: [REGISTERED_REDIRECT_URI],
			maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
			enabled: true,
			generation: 0,
			createdById: user.id,
		});
		await dataSource.getRepository(McpOAuthApproverAuthorityEntity).save({ approverId: user.id, generation: 0 });
		await dataSource.getRepository(McpOAuthServerStateEntity).save({
			key: MCP_OAUTH_SERVER_STATE_KEY,
			serverSecretVersion: 1,
			keyVersion: 1,
			publicIdentityGeneration: 0,
			oauthEnabledGeneration: 0,
			modulePolicyGeneration: 0,
			createdAt: new Date(),
			updatedAt: null,
		});
		persistSmartPanelGrant = async (providerGrantId: string): Promise<void> => {
			const grants = dataSource.getRepository(McpOAuthGrantEntity);

			if (await grants.existsBy({ providerGrantIdHash: hash(providerGrantId) })) return;

			await grants.save({
				providerGrantIdHash: hash(providerGrantId),
				clientId: client.id,
				approvedById: user.id,
				installationId: 'phase3-installation',
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
				oauthEnabledGeneration: 0,
				serverSecretVersion: 1,
				publicIdentityGeneration: 0,
				clientGeneration: 0,
				modulePolicyGeneration: 0,
			});
		};
		const clientsService = {
			findActiveByIdentifier: jest.fn((clientIdentifier: string) =>
				Promise.resolve(clientIdentifier === CLIENT_ID ? client : null),
			),
		} as unknown as McpOAuthClientService;
		const publicUrlService = { getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService;

		const subscriptions = {
			runOAuthMutation: (operation: () => Promise<unknown>) => operation(),
		} as unknown as McpSubscriptionRegistryService;

		factory = new McpOAuthProviderFactory(
			dataSource,
			clientsService,
			publicUrlService,
			{} as McpOAuthProviderMaterialService,
			subscriptions,
			{
				consume: () => Promise.resolve({ allowed: true, retryAfterSeconds: 60 }),
			} as unknown as McpOAuthEndpointRateLimitService,
			{
				assertOpen: () => 0,
				assertOpenGeneration: () => undefined,
			} as unknown as McpOAuthRouteGateService,
		);
		const runtime = await factory.create({
			allowTestInMemory: true,
			allowInsecureTestCookies: true,
			artifactLifecycleHook: (context) => artifactLifecycleHook(context),
			interactionUrl: (uid) => `${origin}/api/v1/modules/mcp/oauth/interaction/${uid}`,
		});
		provider = runtime.provider;
		const providerCallback = runtime.callback;
		interactionService = new McpOAuthInteractionService(
			dataSource.getRepository(McpOAuthInteractionEntity),
			{ getActive: () => ({ provider, urls }) } as unknown as McpOAuthRuntimeService,
			{
				...clientsService,
				isRedirectUriAllowed: (_candidate: McpOAuthClientEntity, requested: string) =>
					requested === REGISTERED_REDIRECT_URI,
			} as unknown as McpOAuthClientService,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			subscriptions,
		);

		server.removeAllListeners('request');
		server.on('request', (request, response) => {
			const url = new URL(request.url ?? '/', origin);
			const issuerPath = '/api/v1/modules/mcp/oauth';

			if (url.pathname.startsWith(`${issuerPath}/interaction/`)) {
				void finishInteraction(provider, request, response).catch((error: Error) => {
					response.statusCode = 500;
					response.end(error.message);
				});
				return;
			}

			if (
				url.pathname === `${issuerPath}/authorize` ||
				url.pathname.startsWith(`${issuerPath}/authorize/`) ||
				url.pathname === `${issuerPath}/token` ||
				url.pathname === `${issuerPath}/token/revocation`
			) {
				request.url = `${url.pathname}${url.search}`;
				void providerCallback(request, response);
				return;
			}

			response.statusCode = 404;
			response.end();
		});
	});

	afterAll(async () => {
		server.close();
		await once(server, 'close');
		await dataSource.destroy();
	});

	const createAuthorizationRequest = (
		redirectUri = REGISTERED_REDIRECT_URI,
		scope: string | null = 'mcp:read offline_access',
		forceConsent = true,
	) => {
		const verifier = randomBytes(32).toString('base64url');
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		const authorizationUrl = new URL(urls.authorizationEndpoint);

		authorizationUrl.search = new URLSearchParams({
			client_id: CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: 'code',
			...(scope === null ? {} : { scope }),
			code_challenge: challenge,
			code_challenge_method: 'S256',
			resource: urls.resource,
			state: 'phase3-state',
			...(forceConsent ? { prompt: 'consent' } : {}),
		}).toString();

		return { authorizationUrl, verifier };
	};

	const authorize = async (
		redirectUri = REGISTERED_REDIRECT_URI,
		scope: string | null = 'mcp:read offline_access',
		browser = new CookieBrowser(),
		forceConsent = true,
	) => {
		const { authorizationUrl, verifier } = createAuthorizationRequest(redirectUri, scope, forceConsent);
		let current = authorizationUrl;

		for (let count = 0; count < 10; count += 1) {
			const response = await browser.fetch(current);
			const location = response.headers.get('location');

			if (!location) throw new Error(`Authorization stopped at ${current} with HTTP ${response.status}`);

			const next = new URL(location, current);

			if (next.pathname === '/callback') return { callback: next, verifier };
			current = next;
		}

		throw new Error('Authorization exceeded the redirect limit');
	};

	const exchangeCode = (code: string, verifier: string) =>
		fetch(urls.tokenEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: CLIENT_ID,
				code,
				code_verifier: verifier,
				redirect_uri: REGISTERED_REDIRECT_URI,
				resource: urls.resource,
			}),
		});

	const refresh = (refreshToken: string) =>
		fetch(urls.tokenEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: CLIENT_ID,
				refresh_token: refreshToken,
				resource: urls.resource,
			}),
		});

	it('projects only the bounded MCP OAuth metadata surface', async () => {
		const runtime = await factory.create({ allowTestInMemory: true });

		expect(runtime.metadata).toEqual({
			issuer: urls.issuer,
			authorization_endpoint: urls.authorizationEndpoint,
			token_endpoint: urls.tokenEndpoint,
			revocation_endpoint: urls.revocationEndpoint,
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			code_challenge_methods_supported: ['S256'],
			scopes_supported: ['mcp:read', 'mcp:write', 'mcp:trigger', 'offline_access'],
			token_endpoint_auth_methods_supported: ['none'],
			authorization_response_iss_parameter_supported: true,
		});
	});

	it('authorizes a dynamically pre-registered public client with PKCE S256', async () => {
		const { callback, verifier } = await authorize();
		const code = callback.searchParams.get('code');

		expect(code).not.toBeNull();
		expect(callback.searchParams.get('iss')).toBe(urls.issuer);
		expect(callback.searchParams.get('state')).toBe('phase3-state');

		const response = await exchangeCode(code, verifier);
		const tokens = (await response.json()) as TokenResponse;

		expect(response.status).toBe(200);
		expect(tokens.token_type).toBe('Bearer');
		expect(tokens.access_token.split('.')).toHaveLength(1);
		expect(tokens.refresh_token?.split('.')).toHaveLength(1);

		if (!code || !tokens.refresh_token) throw new Error('Expected opaque authorization artifacts');

		for (const [model, rawValue] of [
			['AuthorizationCode', code],
			['AccessToken', tokens.access_token],
			['RefreshToken', tokens.refresh_token],
		] as const) {
			const artifact = await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
				model,
				idHash: createHash('sha256').update(rawValue).digest('hex'),
			});

			expect(JSON.parse(artifact.payload)).not.toHaveProperty('jti');
			expect(artifact.payload).not.toContain(rawValue);
			expect(artifact.managementId).toMatch(/^[0-9a-f-]{36}$/);
			expect(artifact.managementId).not.toBe(artifact.idHash);
		}

		const accessArtifact = await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
			model: 'AccessToken',
			idHash: createHash('sha256').update(tokens.access_token).digest('hex'),
		});
		const refreshArtifact = await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
			model: 'RefreshToken',
			idHash: createHash('sha256').update(tokens.refresh_token).digest('hex'),
		});

		expect(accessArtifact.refreshFamilyId).toBe(refreshArtifact.refreshFamilyId);
		expect(refreshArtifact.refreshFamilyId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('denies consent through the production interaction service without issuing artifacts', async () => {
		const grants = dataSource.getRepository(McpOAuthGrantEntity);
		const artifacts = dataSource.getRepository(McpOAuthProviderArtifactEntity);
		const interactions = dataSource.getRepository(McpOAuthInteractionEntity);
		const beforeGrantCount = await grants.count();
		const artifactModels = ['Grant', 'AuthorizationCode', 'AccessToken', 'RefreshToken'] as const;
		const beforeArtifactCounts = new Map<string, number>();

		for (const model of artifactModels) beforeArtifactCounts.set(model, await artifacts.countBy({ model }));
		denyNextConsent = true;
		deniedInteraction = undefined;

		const { callback } = await authorize();

		expect(callback.searchParams.get('error')).toBe('access_denied');
		expect(callback.searchParams.get('state')).toBe('phase3-state');
		expect(callback.searchParams.get('iss')).toBe(urls.issuer);
		expect(callback.searchParams.has('code')).toBe(false);
		expect(await grants.count()).toBe(beforeGrantCount);
		for (const [model, count] of beforeArtifactCounts) {
			expect(await artifacts.countBy({ model })).toBe(count);
		}

		if (!deniedInteraction || !interactionService) throw new Error('Expected the denied interaction to be captured');

		const consumed = await interactions.findOneByOrFail({ uidHash: hash(deniedInteraction.uid) });
		const replayRequest = {
			headers: { cookie: deniedInteraction.cookie },
			method: 'GET',
			url: deniedInteraction.url,
		} as IncomingMessage;

		expect(consumed.consumedAt).toBeInstanceOf(Date);
		await expect(interactionService.deny(deniedInteraction.uid, ACCOUNT_ID, replayRequest)).rejects.toThrow();
	});

	it('defaults an omitted scope to capability scopes without issuing renewable access', async () => {
		const { callback, verifier } = await authorize(REGISTERED_REDIRECT_URI, null);
		const response = await exchangeCode(callback.searchParams.get('code'), verifier);
		const tokens = (await response.json()) as TokenResponse;

		expect(response.status).toBe(200);
		expect(tokens.scope).toBe(McpOAuthScope.READ);
		expect(tokens.refresh_token).toBeUndefined();
	});

	it('rejects an explicitly requested resource scope above the client ceiling before consent', async () => {
		const before = consentPromptCount;
		const response = await fetch(
			createAuthorizationRequest(REGISTERED_REDIRECT_URI, McpOAuthScope.WRITE).authorizationUrl,
			{
				redirect: 'manual',
			},
		);
		const callback = new URL(response.headers.get('location') ?? '', origin);

		expect(response.status).toBe(303);
		expect(callback.pathname).toBe('/callback');
		expect(callback.searchParams.get('error')).toBe('invalid_scope');
		expect(consentPromptCount).toBe(before);
	});

	it('does not add capabilities to an explicit offline-only request without consent prompting', async () => {
		const before = consentPromptCount;
		const response = await fetch(
			createAuthorizationRequest(REGISTERED_REDIRECT_URI, McpOAuthScope.OFFLINE_ACCESS, false).authorizationUrl,
			{ redirect: 'manual' },
		);
		const callback = new URL(response.headers.get('location') ?? '', origin);

		expect(response.status).toBe(303);
		expect(callback.pathname).toBe('/callback');
		expect(callback.searchParams.get('error')).toBe('invalid_scope');
		expect(consentPromptCount).toBe(before);
	});

	it('requires fresh consent even when the browser has an existing client grant', async () => {
		const browser = new CookieBrowser();
		const before = consentPromptCount;

		await authorize(REGISTERED_REDIRECT_URI, 'mcp:read', browser, false);
		await authorize(REGISTERED_REDIRECT_URI, 'mcp:read', browser, false);

		expect(consentPromptCount - before).toBe(2);
	});

	it('rejects code replay and a wrong PKCE verifier', async () => {
		const first = await authorize();
		const firstCode = first.callback.searchParams.get('code');

		expect((await exchangeCode(firstCode, first.verifier)).status).toBe(200);
		expect((await exchangeCode(firstCode, first.verifier)).status).toBe(400);

		const second = await authorize();
		const wrongVerifier = randomBytes(32).toString('base64url');

		expect((await exchangeCode(second.callback.searchParams.get('code'), wrongVerifier)).status).toBe(400);
	});

	it('applies only the RFC 8252 loopback IP runtime-port exception', async () => {
		expect((await authorize('http://127.0.0.1:49152/callback')).callback.searchParams.has('code')).toBe(true);

		const wrongPath = await fetch(createAuthorizationRequest('http://127.0.0.1:49152/other').authorizationUrl, {
			redirect: 'manual',
		});

		expect(wrongPath.status).toBe(400);
		expect(wrongPath.headers.get('location')).toBeNull();
	});

	it('requires resource at both supported token grants in the provider callback', async () => {
		expect(() => factory.assertTokenRequestResource(new URLSearchParams({ grant_type: 'authorization_code' }))).toThrow(
			/invalid_target/,
		);
		expect(() => factory.assertTokenRequestResource(new URLSearchParams({ grant_type: 'refresh_token' }))).toThrow(
			/invalid_target/,
		);
		expect(() =>
			factory.assertTokenRequestResource(
				new URLSearchParams({ grant_type: 'authorization_code', resource: urls.resource }),
			),
		).not.toThrow();

		const authorization = await authorize();
		const code = authorization.callback.searchParams.get('code');
		const missingCodeResource = await fetch(urls.tokenEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: CLIENT_ID,
				code,
				code_verifier: authorization.verifier,
				redirect_uri: REGISTERED_REDIRECT_URI,
			}),
		});
		const missingCodeBody = (await missingCodeResource.json()) as { error: string };

		expect(missingCodeResource.status).toBe(400);
		expect(missingCodeBody.error).toBe('invalid_target');

		const tokenResponse = await exchangeCode(code, authorization.verifier);
		const tokens = (await tokenResponse.json()) as TokenResponse;
		const refreshToken = tokens.refresh_token;

		if (!refreshToken) throw new Error('Expected refresh token for callback boundary test');

		const missingRefreshResource = await fetch(urls.tokenEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: CLIENT_ID,
				refresh_token: refreshToken,
			}),
		});

		expect(missingRefreshResource.status).toBe(400);
		expect(await missingRefreshResource.json()).toEqual(expect.objectContaining({ error: 'invalid_target' }));
		expect((await refresh(refreshToken)).status).toBe(200);
	});

	it('returns authorization boundary errors through a safely validated client redirect', async () => {
		const withoutState = createAuthorizationRequest().authorizationUrl;
		withoutState.searchParams.delete('state');
		const missingStateResponse = await fetch(withoutState, { redirect: 'manual' });
		const missingStateLocation = new URL(missingStateResponse.headers.get('location') ?? '', withoutState);
		const withoutResource = createAuthorizationRequest().authorizationUrl;
		withoutResource.searchParams.delete('resource');
		const missingResourceResponse = await fetch(withoutResource, { redirect: 'manual' });
		const missingResourceLocation = new URL(missingResourceResponse.headers.get('location') ?? '', withoutResource);
		const unsafeRedirect = createAuthorizationRequest('http://attacker.example/callback').authorizationUrl;
		unsafeRedirect.searchParams.delete('resource');
		const unsafeRedirectResponse = await fetch(unsafeRedirect, { redirect: 'manual' });

		expect(missingStateResponse.status).toBe(303);
		expect(missingStateLocation.origin + missingStateLocation.pathname).toBe(REGISTERED_REDIRECT_URI);
		expect(missingStateLocation.searchParams.get('error')).toBe('invalid_request');
		expect(missingStateLocation.searchParams.get('iss')).toBe(urls.issuer);
		expect(missingResourceResponse.status).toBe(303);
		expect(missingResourceLocation.origin + missingResourceLocation.pathname).toBe(REGISTERED_REDIRECT_URI);
		expect(missingResourceLocation.searchParams.get('error')).toBe('invalid_target');
		expect(missingResourceLocation.searchParams.get('state')).toBe('phase3-state');
		expect(missingResourceLocation.searchParams.get('iss')).toBe(urls.issuer);
		expect(unsafeRedirectResponse.status).toBe(400);
		expect(unsafeRedirectResponse.headers.get('location')).toBeNull();
	});

	it('preserves the refresh family absolute expiry across rotation', async () => {
		const authorization = await authorize();
		const response = await exchangeCode(authorization.callback.searchParams.get('code'), authorization.verifier);
		const initial = (await response.json()) as TokenResponse;
		const initialRefreshToken = initial.refresh_token;

		if (!initialRefreshToken) throw new Error('Expected an initial refresh token');

		const repository = dataSource.getRepository(McpOAuthProviderArtifactEntity);
		const initialArtifact = await repository.findOneByOrFail({
			model: 'RefreshToken',
			idHash: createHash('sha256').update(initialRefreshToken).digest('hex'),
		});
		const initialPayload = JSON.parse(initialArtifact.payload) as { iiat: number };
		const elapsedSeconds = 10 * 24 * 60 * 60;
		initialPayload.iiat -= elapsedSeconds;
		initialArtifact.payload = JSON.stringify(initialPayload);
		await repository.save(initialArtifact);

		const refreshResponse = await refresh(initialRefreshToken);
		const successor = (await refreshResponse.json()) as TokenResponse;
		const successorRefreshToken = successor.refresh_token;

		if (!successorRefreshToken) throw new Error('Expected a rotated refresh token');

		const successorArtifact = await repository.findOneByOrFail({
			model: 'RefreshToken',
			idHash: createHash('sha256').update(successorRefreshToken).digest('hex'),
		});
		const familyExpiry = (initialPayload.iiat + 30 * 24 * 60 * 60) * 1_000;

		expect(refreshResponse.status).toBe(200);
		expect(successorArtifact.managementId).not.toBe(initialArtifact.managementId);
		expect(successorArtifact.refreshFamilyId).toBe(initialArtifact.refreshFamilyId);
		expect(successorArtifact.expiresAt).toBeLessThanOrEqual(familyExpiry);
		expect(successorArtifact.expiresAt).toBeGreaterThan(familyExpiry - 2_000);
	});

	it('commits refresh-family revocation before reporting token reuse', async () => {
		const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
			allowTestInMemory: true,
			artifactReuseError: () => new Error('refresh token reused'),
		});
		const adapter = new Adapter('RefreshToken');
		const rawRefreshToken = `refresh-${randomBytes(24).toString('base64url')}`;
		const rawGrantId = `grant-${randomBytes(24).toString('base64url')}`;
		await persistSmartPanelGrant(rawGrantId);

		await adapter.upsert(
			rawRefreshToken,
			{
				jti: rawRefreshToken,
				kind: 'RefreshToken',
				grantId: rawGrantId,
				iat: Math.floor(Date.now() / 1_000),
				exp: Math.floor(Date.now() / 1_000) + 60,
			},
			60,
		);
		await adapter.consume(rawRefreshToken);
		await expect(adapter.consume(rawRefreshToken)).rejects.toThrow('refresh token reused');

		const grantIdHash = createHash('sha256').update(rawGrantId).digest('hex');

		expect(await dataSource.getRepository(McpOAuthProviderRevokedGrantEntity).existsBy({ grantIdHash })).toBe(true);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).existsBy({ grantIdHash })).toBe(false);
	});

	it('allows at most one barrier-synchronized refresh successor and revokes the complete family', async () => {
		const authorization = await authorize();
		const initialResponse = await exchangeCode(authorization.callback.searchParams.get('code'), authorization.verifier);
		const initial = (await initialResponse.json()) as TokenResponse;
		const initialRefreshToken = initial.refresh_token;

		if (!initialRefreshToken) throw new Error('Expected an initial refresh token');

		const artifacts = dataSource.getRepository(McpOAuthProviderArtifactEntity);
		const initialRefreshArtifact = await artifacts.findOneByOrFail({
			model: 'RefreshToken',
			idHash: hash(initialRefreshToken),
		});
		const refreshFamilyId = initialRefreshArtifact.refreshFamilyId;
		const grantIdHash = initialRefreshArtifact.grantIdHash;

		if (!refreshFamilyId || !grantIdHash) throw new Error('Expected the initial refresh token family and grant');

		const upsertSpy = jest.spyOn(artifacts, 'upsert');
		const enterConsumeBarrier = createBarrier(2);
		let consumeAttempts = 0;
		let markSuccessorStored = (): void => undefined;
		const successorStored = new Promise<void>((resolve) => {
			markSuccessorStored = resolve;
		});
		const lifecycleHook = jest.fn(async (context: Parameters<typeof artifactLifecycleHook>[0]): Promise<void> => {
			if (context.model !== 'RefreshToken') return;

			if (context.phase === 'before-consume') {
				await enterConsumeBarrier();
				return;
			}

			if (context.phase === 'before-consume-transaction') {
				consumeAttempts += 1;

				if (consumeAttempts === 2) await successorStored;
				return;
			}

			if (context.phase === 'after-upsert' && context.refreshFamilyId === refreshFamilyId) markSuccessorStored();
		});
		artifactLifecycleHook = lifecycleHook;

		try {
			const responses = await Promise.all([refresh(initialRefreshToken), refresh(initialRefreshToken)]);
			const bodies = (await Promise.all(responses.map((response) => response.json()))) as Array<
				TokenResponse | { error: string }
			>;
			const successful = bodies.filter((body): body is TokenResponse => 'access_token' in body);
			const successorUpserts = upsertSpy.mock.calls.filter(
				([entity]) => isRecord(entity) && entity.model === 'RefreshToken' && entity.refreshFamilyId === refreshFamilyId,
			);
			const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
				allowTestInMemory: true,
			});
			const accessAdapter = new Adapter('AccessToken');
			const refreshAdapter = new Adapter('RefreshToken');

			expect(responses.every(({ status }) => status < 500)).toBe(true);
			expect(lifecycleHook).toHaveBeenCalledWith({ phase: 'after-upsert', model: 'RefreshToken', refreshFamilyId });
			expect(successful.length).toBeLessThanOrEqual(1);
			expect(successorUpserts).toHaveLength(1);
			expect(bodies).toContainEqual(expect.objectContaining({ error: 'invalid_grant' }));
			expect(await artifacts.countBy({ refreshFamilyId })).toBe(0);
			expect(await dataSource.getRepository(McpOAuthProviderRevokedGrantEntity).existsBy({ grantIdHash })).toBe(true);
			await expect(accessAdapter.find(initial.access_token)).resolves.toBeUndefined();
			await expect(refreshAdapter.find(initialRefreshToken)).resolves.toBeUndefined();
			expect((await refresh(initialRefreshToken)).status).toBe(400);

			for (const tokens of successful) {
				if (!tokens.refresh_token) throw new Error('Expected a rotated refresh token');

				await expect(accessAdapter.find(tokens.access_token)).resolves.toBeUndefined();
				await expect(refreshAdapter.find(tokens.refresh_token)).resolves.toBeUndefined();
				expect((await refresh(tokens.refresh_token)).status).toBe(400);
			}
		} finally {
			artifactLifecycleHook = () => Promise.resolve();
			upsertSpy.mockRestore();
		}
	});

	it('implements RFC 7009 revocation for access and refresh tokens', async () => {
		const authorization = await authorize();
		const response = await exchangeCode(authorization.callback.searchParams.get('code'), authorization.verifier);
		const tokens = (await response.json()) as TokenResponse;
		const accessRevocation = await fetch(urls.revocationEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: CLIENT_ID, token: tokens.access_token, token_type_hint: 'access_token' }),
		});
		const refreshRevocation = await fetch(urls.revocationEndpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				token: tokens.refresh_token,
				token_type_hint: 'refresh_token',
			}),
		});

		expect(accessRevocation.status).toBe(200);
		expect(refreshRevocation.status).toBe(200);
		expect((await refresh(tokens.refresh_token)).status).toBe(400);
	});

	it('synchronizes handlers with policy and authority invalidation', runMcpOAuthHandlerInvalidationRaces);
});
