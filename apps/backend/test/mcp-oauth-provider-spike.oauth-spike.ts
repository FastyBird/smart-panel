import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Provider from 'oidc-provider';
import { DataSource } from 'typeorm';

import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { loadMcpOAuthProvider } from '../src/modules/mcp/oauth/mcp-oauth-provider.loader';

import {
	McpOAuthSpikeArtifactSchema,
	McpOAuthSpikeRevokedGrantSchema,
	createMcpOAuthSpikeAdapter,
} from './support/mcp-oauth-spike-adapter';

const OAUTH_PATH = '/oauth-spike';
const CLIENT_ID = 'mcp-oauth-spike-client';
const ACCOUNT_ID = 'owner-1';
const REGISTERED_REDIRECT_URI = 'http://127.0.0.1:49152/callback';
const REGISTERED_HTTPS_REDIRECT_URI = 'https://client.example/callback';
const COOKIE_KEY = '0123456789abcdef0123456789abcdef';

interface AuthorizationServerMetadata {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	revocation_endpoint: string;
	response_types_supported: string[];
	grant_types_supported: string[];
	code_challenge_methods_supported: string[];
	scopes_supported: string[];
	token_endpoint_auth_methods_supported: string[];
	authorization_response_iss_parameter_supported: boolean;
}

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

interface InteractionObservation {
	prompt: string;
	clientId: string;
	parameters: Record<string, unknown>;
	details: Record<string, unknown>;
}

@Controller('oauth-spike-host')
class McpOAuthSpikeHostController {
	@Get('health')
	health(): { status: string } {
		return { status: 'ok' };
	}
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

const reservePort = async (): Promise<number> => {
	const server = createServer();

	server.listen(0, '127.0.0.1');
	await once(server, 'listening');

	const address = server.address();

	if (address === null || typeof address === 'string') {
		server.close();
		throw new Error('Failed to reserve an IPv4 test port');
	}

	const { port } = address;

	server.close();
	await once(server, 'close');

	return port;
};

const projectMetadata = (issuer: string): AuthorizationServerMetadata => ({
	issuer,
	authorization_endpoint: `${issuer}/auth`,
	token_endpoint: `${issuer}/token`,
	revocation_endpoint: `${issuer}/token/revocation`,
	response_types_supported: ['code'],
	grant_types_supported: ['authorization_code', 'refresh_token'],
	code_challenge_methods_supported: ['S256'],
	scopes_supported: ['mcp:read', 'mcp:write', 'mcp:trigger', 'offline_access'],
	token_endpoint_auth_methods_supported: ['none'],
	authorization_response_iss_parameter_supported: true,
});

const writeJson = (response: ServerResponse, body: unknown): void => {
	response.statusCode = 200;
	response.setHeader('cache-control', 'no-store');
	response.setHeader('content-type', 'application/json');
	response.end(JSON.stringify(body));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

const finishInteraction = async (
	provider: Provider,
	request: IncomingMessage,
	response: ServerResponse,
	observations: InteractionObservation[],
): Promise<void> => {
	const details = await provider.interactionDetails(request, response);
	const clientId = details.params.client_id;
	const promptDetails = isRecord(details.prompt.details) ? details.prompt.details : {};

	if (typeof clientId !== 'string') {
		throw new Error('OAuth interaction is missing a string client ID');
	}

	observations.push({
		prompt: details.prompt.name,
		clientId,
		parameters: { ...details.params },
		details: { ...promptDetails },
	});

	if (details.prompt.name === 'login') {
		await provider.interactionFinished(
			request,
			response,
			{ login: { accountId: ACCOUNT_ID, acr: 'smart-panel-session', amr: ['pwd'] } },
			{ mergeWithLastSubmission: false },
		);

		return;
	}

	if (details.prompt.name !== 'consent') {
		throw new Error(`Unexpected OAuth interaction prompt: ${details.prompt.name}`);
	}

	const accountId = details.session?.accountId;

	if (accountId === undefined) {
		throw new Error('Consent interaction is missing the authenticated Smart Panel account');
	}

	let grant = details.grantId === undefined ? undefined : await provider.Grant.find(details.grantId);

	grant ??= new provider.Grant({ accountId, clientId });

	const missingOidcScope = promptDetails.missingOIDCScope;

	if (isStringArray(missingOidcScope)) {
		grant.addOIDCScope(missingOidcScope.join(' '));
	}

	const missingOidcClaims = promptDetails.missingOIDCClaims;

	if (isStringArray(missingOidcClaims)) {
		grant.addOIDCClaims(missingOidcClaims);
	}

	const missingResourceScopes = promptDetails.missingResourceScopes;

	if (isRecord(missingResourceScopes)) {
		for (const [resource, scopes] of Object.entries(missingResourceScopes)) {
			if (isStringArray(scopes)) {
				grant.addResourceScope(resource, scopes.join(' '));
			}
		}
	}

	const grantId = await grant.save();

	await provider.interactionFinished(
		request,
		response,
		{ consent: details.grantId === undefined ? { grantId } : {} },
		{ mergeWithLastSubmission: true },
	);
};

describe('MCP OAuth authorization-component spike', () => {
	let app: NestFastifyApplication;
	let dataSource: DataSource;
	let provider: Provider;
	let origin: string;
	let issuer: string;
	let resource: string;
	let metadata: AuthorizationServerMetadata;
	let providerCallback: ReturnType<Provider['callback']>;
	let adapter: ReturnType<typeof createMcpOAuthSpikeAdapter>;
	const interactions: InteractionObservation[] = [];

	beforeAll(async () => {
		const port = await reservePort();

		origin = `http://127.0.0.1:${port}`;
		issuer = `${origin}${OAUTH_PATH}`;
		resource = `${origin}/api/v1/modules/mcp`;
		metadata = projectMetadata(issuer);
		const oidcProvider = await loadMcpOAuthProvider();

		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [McpOAuthSpikeArtifactSchema, McpOAuthSpikeRevokedGrantSchema],
			synchronize: true,
		});
		await dataSource.initialize();

		adapter = createMcpOAuthSpikeAdapter(dataSource, {
			allowTestInMemory: true,
			artifactReuseError: () => new oidcProvider.errors.InvalidGrant('OAuth artifact already used'),
		});

		const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'jwk' });

		provider = new oidcProvider.default(issuer, {
			adapter,
			clients: [
				{
					client_id: CLIENT_ID,
					client_name: 'MCP OAuth spike client',
					application_type: 'native',
					redirect_uris: [REGISTERED_REDIRECT_URI, REGISTERED_HTTPS_REDIRECT_URI],
					response_types: ['code'],
					grant_types: ['authorization_code', 'refresh_token'],
					token_endpoint_auth_method: 'none',
				},
			],
			clientAuthMethods: ['none'],
			responseTypes: ['code'],
			scopes: metadata.scopes_supported,
			allowOmittingSingleRegisteredRedirectUri: false,
			acceptQueryParamAccessTokens: false,
			cookies: { keys: [COOKIE_KEY] },
			features: {
				devInteractions: { enabled: false },
				dPoP: { enabled: false },
				pushedAuthorizationRequests: { enabled: false },
				rpInitiatedLogout: { enabled: false },
				userinfo: { enabled: false },
				introspection: { enabled: false },
				registration: { enabled: false },
				clientCredentials: { enabled: false },
				deviceFlow: { enabled: false },
				revocation: { enabled: true },
				resourceIndicators: {
					enabled: true,
					defaultResource: () => {
						throw new oidcProvider.errors.InvalidTarget('The MCP resource parameter is required');
					},
					useGrantedResource: () => false,
					getResourceServerInfo: (_context, requestedResource) => {
						if (requestedResource !== resource) {
							throw new oidcProvider.errors.InvalidTarget('The MCP resource does not match this installation');
						}

						return {
							scope: 'mcp:read mcp:write mcp:trigger',
							audience: resource,
							accessTokenTTL: 600,
							accessTokenFormat: 'opaque',
						};
					},
				},
			},
			pkce: { required: () => true },
			issueRefreshToken: (_context, _client, code) => code.scopes.has('offline_access'),
			rotateRefreshToken: true,
			interactions: { url: (_context, interaction) => `${OAUTH_PATH}/interaction/${interaction.uid}` },
			findAccount: (_context, accountId) => ({
				accountId,
				claims: () => ({ sub: accountId }),
			}),
			ttl: {
				AccessToken: 600,
				AuthorizationCode: 60,
				RefreshToken: 30 * 24 * 60 * 60,
				Grant: 90 * 24 * 60 * 60,
			},
			jwks: {
				keys: [{ ...privateKey, use: 'sig', alg: 'RS256', kid: 'mcp-oauth-spike' }],
			},
		});
		providerCallback = provider.callback();

		const moduleRef = await Test.createTestingModule({
			controllers: [McpOAuthSpikeHostController],
		}).compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		app.use((request: IncomingMessage, response: ServerResponse, next: (error?: Error) => void) => {
			const requestUrl = new URL(request.url ?? '/', origin);

			if (requestUrl.pathname === `/.well-known/oauth-authorization-server${OAUTH_PATH}`) {
				writeJson(response, metadata);
				return;
			}

			if (requestUrl.pathname.startsWith(`${OAUTH_PATH}/interaction/`)) {
				void finishInteraction(provider, request, response, interactions).catch(next);
				return;
			}

			const isProviderPath =
				requestUrl.pathname === `${OAUTH_PATH}/auth` ||
				requestUrl.pathname.startsWith(`${OAUTH_PATH}/auth/`) ||
				requestUrl.pathname === `${OAUTH_PATH}/token` ||
				requestUrl.pathname === `${OAUTH_PATH}/token/revocation`;

			if (isProviderPath) {
				request.url = request.url?.slice(OAUTH_PATH.length) ?? '/';
				void providerCallback(request, response);
				return;
			}

			next();
		});

		await app.listen(port, '127.0.0.1');
	});

	afterEach(() => {
		interactions.length = 0;
	});

	afterAll(async () => {
		await app.close();
		await dataSource.destroy();
	});

	const createAuthorizationRequest = (
		redirectUri = REGISTERED_REDIRECT_URI,
		requestedResource = resource,
		requestedScope = 'mcp:read offline_access',
		codeChallengeMethod = 'S256',
	): { authorizationUrl: URL; verifier: string } => {
		const verifier = randomBytes(32).toString('base64url');
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		const authorizationUrl = new URL(`${issuer}/auth`);

		authorizationUrl.search = new URLSearchParams({
			client_id: CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: requestedScope,
			code_challenge: challenge,
			code_challenge_method: codeChallengeMethod,
			resource: requestedResource,
			state: 'spike-state',
			prompt: 'consent',
		}).toString();

		return { authorizationUrl, verifier };
	};

	const authorize = async (
		redirectUri = REGISTERED_REDIRECT_URI,
		requestedResource = resource,
		requestedScope = 'mcp:read offline_access',
	): Promise<{ callback: URL; verifier: string }> => {
		const { authorizationUrl, verifier } = createAuthorizationRequest(redirectUri, requestedResource, requestedScope);

		const browser = new CookieBrowser();
		let currentUrl = authorizationUrl;

		for (let redirectCount = 0; redirectCount < 10; redirectCount += 1) {
			const response = await browser.fetch(currentUrl);
			const location = response.headers.get('location');

			if (location === null) {
				throw new Error(`Authorization stopped at ${currentUrl} with HTTP ${response.status}`);
			}

			const nextUrl = new URL(location, currentUrl);

			if (nextUrl.origin !== origin || nextUrl.pathname === '/callback') {
				return { callback: nextUrl, verifier };
			}

			currentUrl = nextUrl;
		}

		throw new Error(
			`Authorization exceeded the redirect limit at ${currentUrl}; interactions: ${JSON.stringify(interactions)}`,
		);
	};

	const exchangeCode = async (
		code: string,
		verifier: string,
		requestedResource: string | undefined = resource,
		redirectUri = REGISTERED_REDIRECT_URI,
	): Promise<Response> => {
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: redirectUri,
		});

		if (requestedResource !== undefined) {
			body.set('resource', requestedResource);
		}

		return fetch(`${issuer}/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
		});
	};

	const refresh = async (refreshToken: string): Promise<Response> =>
		fetch(`${issuer}/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: CLIENT_ID,
				refresh_token: refreshToken,
				resource,
			}),
		});

	it('mounts on NestJS/Fastify without intercepting unrelated routes', async () => {
		const healthResponse = await fetch(`${origin}/oauth-spike-host/health`);
		const unrelatedResponse = await fetch(`${origin}/not-an-oauth-route`);

		expect(healthResponse.status).toBe(200);
		expect(await healthResponse.json()).toEqual({ status: 'ok' });
		expect(unrelatedResponse.status).toBe(404);
	});

	it('publishes the deliberately bounded RFC 8414 metadata projection', async () => {
		const response = await fetch(`${origin}/.well-known/oauth-authorization-server${OAUTH_PATH}`);
		const document = (await response.json()) as AuthorizationServerMetadata;

		expect(response.status).toBe(200);
		expect(document).toEqual(metadata);
		expect(Object.keys(document).sort()).toMatchInlineSnapshot(`
[
  "authorization_endpoint",
  "authorization_response_iss_parameter_supported",
  "code_challenge_methods_supported",
  "grant_types_supported",
  "issuer",
  "response_types_supported",
  "revocation_endpoint",
  "scopes_supported",
  "token_endpoint",
  "token_endpoint_auth_methods_supported",
]
`);
		expect(document).not.toHaveProperty('claims_supported');
		expect(document).not.toHaveProperty('id_token_signing_alg_values_supported');
		expect(document).not.toHaveProperty('introspection_endpoint');
		expect(document).not.toHaveProperty('jwks_uri');
		expect(document).not.toHaveProperty('registration_endpoint');
		expect(document).not.toHaveProperty('userinfo_endpoint');
	});

	it('delegates login and consent without receiving a password and exchanges an opaque PKCE code', async () => {
		const { callback, verifier } = await authorize();
		const code = callback.searchParams.get('code');

		expect(code).not.toBeNull();
		expect(callback.searchParams.get('iss')).toBe(issuer);
		expect(callback.searchParams.get('state')).toBe('spike-state');
		expect(interactions.map(({ prompt }) => prompt)).toEqual(['login', 'consent']);
		expect(interactions.every(({ parameters }) => !('password' in parameters))).toBe(true);

		const tokenResponse = await exchangeCode(code, verifier);
		const tokens = (await tokenResponse.json()) as TokenResponse;

		expect(tokenResponse.status).toBe(200);
		expect(tokens.token_type).toBe('Bearer');
		expect(tokens.expires_in).toBe(600);
		expect(tokens.access_token.split('.')).toHaveLength(1);
		expect(tokens.refresh_token).toBeDefined();
		expect(await new adapter('AccessToken').find(tokens.access_token)).toMatchObject({
			aud: resource,
			scope: 'mcp:read',
		});
	});

	it('rejects authorization-code replay', async () => {
		const { callback, verifier } = await authorize();
		const code = callback.searchParams.get('code');

		expect((await exchangeCode(code, verifier)).status).toBe(200);

		const replayResponse = await exchangeCode(code, verifier);

		expect(replayResponse.status).toBe(400);
		expect(await replayResponse.json()).toMatchObject({ error: 'invalid_grant' });
	});

	it('rejects a wrong PKCE verifier', async () => {
		const { callback } = await authorize();
		const response = await exchangeCode(callback.searchParams.get('code'), randomBytes(32).toString('base64url'));

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: 'invalid_grant' });
	});

	it('rejects a PKCE method downgrade', async () => {
		const { authorizationUrl } = createAuthorizationRequest(REGISTERED_REDIRECT_URI, resource, 'mcp:read', 'plain');
		const response = await fetch(authorizationUrl, { redirect: 'manual' });
		const callback = new URL(response.headers.get('location'));

		expect(response.status).toBe(303);
		expect(callback.searchParams.get('error')).toBe('invalid_request');
		expect(callback.searchParams.get('iss')).toBe(issuer);
	});

	it('rejects a resource mismatch during authorization', async () => {
		const { callback } = await authorize(REGISTERED_REDIRECT_URI, `${origin}/wrong-resource`);

		expect(callback.searchParams.get('error')).toBe('invalid_target');
		expect(callback.searchParams.get('iss')).toBe(issuer);
	});

	it('requires the resource indicator during authorization and rejects a token resource mismatch', async () => {
		const missingAuthorizationResource = createAuthorizationRequest();

		missingAuthorizationResource.authorizationUrl.searchParams.delete('resource');

		const authorizationResponse = await fetch(missingAuthorizationResource.authorizationUrl, { redirect: 'manual' });
		const authorizationError = new URL(authorizationResponse.headers.get('location'));
		const { callback, verifier } = await authorize();
		const tokenResponse = await exchangeCode(callback.searchParams.get('code'), verifier, `${origin}/wrong-resource`);

		expect(authorizationError.searchParams.get('error')).toBe('invalid_target');
		expect(authorizationError.searchParams.get('iss')).toBe(issuer);
		expect(tokenResponse.status).toBe(400);
		expect(await tokenResponse.json()).toMatchObject({ error: 'invalid_target' });
	});

	it('matches non-loopback redirects exactly and applies only the RFC 8252 loopback-IP port exception', async () => {
		const variablePort = await authorize('http://127.0.0.1:54321/callback');
		const exactHttps = await authorize(REGISTERED_HTTPS_REDIRECT_URI);
		const wrongAddress = await fetch(createAuthorizationRequest('http://127.0.0.2:49152/callback').authorizationUrl, {
			redirect: 'manual',
		});
		const wrongPath = await fetch(createAuthorizationRequest('http://127.0.0.1:49152/other').authorizationUrl, {
			redirect: 'manual',
		});
		const wrongHttpsPath = await fetch(createAuthorizationRequest('https://client.example/other').authorizationUrl, {
			redirect: 'manual',
		});

		expect(variablePort.callback.searchParams.has('code')).toBe(true);
		expect(exactHttps.callback.searchParams.has('code')).toBe(true);
		expect(wrongAddress.status).toBe(400);
		expect(wrongAddress.headers.get('location')).toBeNull();
		expect(wrongPath.status).toBe(400);
		expect(wrongPath.headers.get('location')).toBeNull();
		expect(wrongHttpsPath.status).toBe(400);
		expect(wrongHttpsPath.headers.get('location')).toBeNull();
	});

	it('issues refresh tokens only when offline access was explicitly requested and consented', async () => {
		const { callback, verifier } = await authorize(REGISTERED_REDIRECT_URI, resource, 'mcp:read');
		const response = await exchangeCode(callback.searchParams.get('code'), verifier);
		const tokens = (await response.json()) as TokenResponse;

		expect(response.status).toBe(200);
		expect(tokens.refresh_token).toBeUndefined();
	});

	it('rotates refresh tokens and revokes access tokens', async () => {
		const { callback, verifier } = await authorize();
		const tokenResponse = await exchangeCode(callback.searchParams.get('code'), verifier);
		const firstTokens = (await tokenResponse.json()) as TokenResponse;
		const refreshResponse = await refresh(firstTokens.refresh_token);
		const rotatedTokens = (await refreshResponse.json()) as TokenResponse;

		expect(refreshResponse.status).toBe(200);
		expect(rotatedTokens.refresh_token).toBeDefined();
		expect(rotatedTokens.refresh_token).not.toBe(firstTokens.refresh_token);

		const revokeResponse = await fetch(`${issuer}/token/revocation`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				token: rotatedTokens.access_token,
				token_type_hint: 'access_token',
			}),
		});

		expect(revokeResponse.status).toBe(200);
		expect(await new adapter('AccessToken').find(rotatedTokens.access_token)).toBeUndefined();
	});

	it('atomically rejects concurrent refresh reuse and revokes the complete token family', async () => {
		const { callback, verifier } = await authorize();
		const initialResponse = await exchangeCode(callback.searchParams.get('code'), verifier);
		const initialTokens = (await initialResponse.json()) as TokenResponse;
		const responses = await Promise.all([refresh(initialTokens.refresh_token), refresh(initialTokens.refresh_token)]);
		const responseBodies = (await Promise.all(responses.map((response) => response.json()))) as Array<
			TokenResponse | { error: string }
		>;
		const successfulTokens = responseBodies.filter((body): body is TokenResponse => 'access_token' in body);
		const rejectedBodies = responseBodies.filter((body): body is { error: string } => 'error' in body);

		expect(responses.every(({ status }) => status < 500)).toBe(true);
		expect(successfulTokens.length).toBeLessThanOrEqual(1);
		expect(rejectedBodies).toContainEqual(expect.objectContaining({ error: 'invalid_grant' }));

		for (const tokens of successfulTokens) {
			expect((await refresh(tokens.refresh_token)).status).toBe(400);
			expect(await new adapter('AccessToken').find(tokens.access_token)).toBeUndefined();
		}

		expect((await refresh(initialTokens.refresh_token)).status).toBe(400);
	});

	it('persists adapter data across TypeORM datasource restarts and guards test memory usage', async () => {
		expect(() => createMcpOAuthSpikeAdapter(dataSource)).toThrow(/explicit test setups/);

		const directory = await mkdtemp(join(tmpdir(), 'mcp-oauth-spike-'));
		const database = join(directory, 'artifacts.sqlite');
		const firstDataSource = new DataSource({
			type: 'sqlite',
			database,
			entities: [McpOAuthSpikeArtifactSchema, McpOAuthSpikeRevokedGrantSchema],
			synchronize: true,
		});

		try {
			await firstDataSource.initialize();
			const FirstAdapter = createMcpOAuthSpikeAdapter(firstDataSource);

			await new FirstAdapter('AuthorizationCode').upsert('persistent-code', { kind: 'AuthorizationCode' }, 60);
			await firstDataSource.destroy();

			const secondDataSource = new DataSource({
				type: 'sqlite',
				database,
				entities: [McpOAuthSpikeArtifactSchema, McpOAuthSpikeRevokedGrantSchema],
				synchronize: true,
			});

			await secondDataSource.initialize();
			const SecondAdapter = createMcpOAuthSpikeAdapter(secondDataSource);

			expect(await new SecondAdapter('AuthorizationCode').find('persistent-code')).toMatchObject({
				kind: 'AuthorizationCode',
			});
			await secondDataSource.destroy();
		} finally {
			if (firstDataSource.isInitialized) {
				await firstDataSource.destroy();
			}

			await rm(directory, { recursive: true, force: true });
		}
	});

	it('allows only one concurrent consume of an adapter artifact', async () => {
		const refreshAdapter = new adapter('RefreshToken');

		await refreshAdapter.upsert('concurrent-refresh', { kind: 'RefreshToken', grantId: 'grant-1' }, 60);

		const results = await Promise.allSettled([
			refreshAdapter.consume('concurrent-refresh'),
			refreshAdapter.consume('concurrent-refresh'),
		]);

		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
		expect(await refreshAdapter.find('concurrent-refresh')).toBeUndefined();
		await expect(
			refreshAdapter.upsert('late-refresh', { kind: 'RefreshToken', grantId: 'grant-1' }, 60),
		).rejects.toThrow();
	});
});
