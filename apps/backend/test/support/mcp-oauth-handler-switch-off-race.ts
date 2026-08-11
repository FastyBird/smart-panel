import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import type Provider from 'oidc-provider';
import { DataSource } from 'typeorm';

import { hashToken } from '../../src/modules/auth/utils/token.utils';
import { ConfigService } from '../../src/modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../../src/modules/config/services/module-config-mutation-registry.service';
import { UpdateMcpConfigDto } from '../../src/modules/mcp/dto/update-config.dto';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthApproverAuthorityEntity,
	McpOAuthAuthorizationCodeEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRefreshFamilyLineageEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
	McpOAuthServerStateEntity,
} from '../../src/modules/mcp/entities/mcp-oauth.entity';
import {
	MCP_MODULE_NAME,
	MCP_OAUTH_SERVER_STATE_KEY,
	McpCapability,
	McpOAuthScope,
} from '../../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../../src/modules/mcp/models/config.model';
import { McpOAuthProviderFactory } from '../../src/modules/mcp/oauth/mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from '../../src/modules/mcp/oauth/mcp-oauth.types';
import { McpAuditService } from '../../src/modules/mcp/services/mcp-audit.service';
import { McpOAuthClientService } from '../../src/modules/mcp/services/mcp-oauth-client.service';
import { McpOAuthEndpointRateLimitService } from '../../src/modules/mcp/services/mcp-oauth-endpoint-rate-limit.service';
import { McpOAuthGlobalInvalidationService } from '../../src/modules/mcp/services/mcp-oauth-global-invalidation.service';
import { McpOAuthLifecycleService } from '../../src/modules/mcp/services/mcp-oauth-lifecycle.service';
import { McpOAuthModuleConfigMutationService } from '../../src/modules/mcp/services/mcp-oauth-module-config-mutation.service';
import { McpOAuthProviderMaterialService } from '../../src/modules/mcp/services/mcp-oauth-provider-material.service';
import { McpOAuthPublicUrlService } from '../../src/modules/mcp/services/mcp-oauth-public-url.service';
import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessService,
} from '../../src/modules/mcp/services/mcp-oauth-readiness.service';
import { McpOAuthRouteGateService } from '../../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../../src/modules/mcp/services/mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from '../../src/modules/mcp/services/mcp-oauth-switch-off.service';
import { McpSubscriptionRegistryService } from '../../src/modules/mcp/services/mcp-subscription-registry.service';
import { UserEntity } from '../../src/modules/users/entities/users.entity';
import { UserLanguage, UserRole } from '../../src/modules/users/users.constants';

const CLIENT_ID = 'handler-race-client';
const ACCOUNT_ID = 'handler-race-owner';
const INSTALLATION_ID = 'handler-race-installation';
const REDIRECT_URI = 'http://127.0.0.1:1455/callback';

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
}

interface ArtifactPause {
	entered: Promise<void>;
	release: () => void;
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

export async function runMcpOAuthHandlerSwitchOffRace(): Promise<void> {
	const dataSource = new DataSource({
		type: 'sqlite',
		database: ':memory:',
		entities: [
			UserEntity,
			McpOAuthAccessTokenEntity,
			McpOAuthApproverAuthorityEntity,
			McpOAuthAuthorizationCodeEntity,
			McpOAuthClientEntity,
			McpOAuthGrantEntity,
			McpOAuthInteractionEntity,
			McpOAuthProviderArtifactEntity,
			McpOAuthProviderRefreshFamilyLineageEntity,
			McpOAuthProviderRevokedGrantEntity,
			McpOAuthProviderRevokedRefreshFamilyEntity,
			McpOAuthRefreshTokenEntity,
			McpOAuthRefreshTokenFamilyEntity,
			McpOAuthServerStateEntity,
		],
		synchronize: true,
	});
	await dataSource.initialize();

	const server = createServer();
	let releaseActivePause = (): void => undefined;

	try {
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
			name: 'Handler race client',
			redirectUris: [REDIRECT_URI],
			maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
			enabled: true,
			generation: 0,
			createdById: user.id,
		});
		await dataSource.getRepository(McpOAuthApproverAuthorityEntity).save({
			approverId: user.id,
			generation: 0,
		});
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

		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		const urls: McpOAuthPublicUrls = {
			publicBaseUrl: origin,
			resource: `${origin}/api/v1/modules/mcp`,
			protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource/api/v1/modules/mcp`,
			issuer: `${origin}/api/v1/modules/mcp/oauth`,
			authorizationServerMetadata: `${origin}/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth`,
			authorizationEndpoint: `${origin}/api/v1/modules/mcp/oauth/authorize`,
			tokenEndpoint: `${origin}/api/v1/modules/mcp/oauth/token`,
			revocationEndpoint: `${origin}/api/v1/modules/mcp/oauth/token/revocation`,
		};
		const config = Object.assign(new McpConfigModel(), {
			enabled: true,
			oauthEnabled: true,
			oauthPublicBaseUrl: urls.publicBaseUrl,
			capabilities: [McpCapability.READ],
		});
		const configService = {
			getModuleConfig: jest.fn((moduleName: string) => {
				if (moduleName === MCP_MODULE_NAME) return config;
				throw new Error(`Unexpected module config request: ${moduleName}`);
			}),
			reload: jest.fn(),
		};
		const clientsService = {
			findActiveByIdentifier: jest.fn((clientIdentifier: string) =>
				Promise.resolve(clientIdentifier === CLIENT_ID ? client : null),
			),
		} as unknown as McpOAuthClientService;
		const auditService = new McpAuditService();
		const subscriptions = new McpSubscriptionRegistryService(auditService);
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const routeGate = new McpOAuthRouteGateService(readiness);
		let beforeArtifactUpsert = (_context: { model: string }): Promise<void> => Promise.resolve();
		const providerFactory = new McpOAuthProviderFactory(
			dataSource,
			clientsService,
			{ getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService,
			{} as McpOAuthProviderMaterialService,
			subscriptions,
			{
				consume: jest.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 60 })),
			} as unknown as McpOAuthEndpointRateLimitService,
			routeGate,
		);
		const runtime = new McpOAuthRuntimeService(
			{
				create: () =>
					providerFactory.create({
						allowTestInMemory: true,
						allowInsecureTestCookies: true,
						beforeArtifactUpsert: (context) => beforeArtifactUpsert(context),
						interactionUrl: (uid) => `${origin}/api/v1/modules/mcp/oauth/interaction/${uid}`,
					}),
			} as unknown as McpOAuthProviderFactory,
			routeGate,
		);
		const lifecycle = new McpOAuthLifecycleService(
			configService as unknown as ConfigService,
			readiness,
			routeGate,
			runtime,
		);
		const globalInvalidation = new McpOAuthGlobalInvalidationService(dataSource, subscriptions);
		const switchOff = new McpOAuthSwitchOffService(routeGate, runtime, globalInvalidation, auditService);
		const moduleConfigMutation = new McpOAuthModuleConfigMutationService(
			configService as unknown as ConfigService,
			dataSource.getRepository(McpOAuthServerStateEntity),
			subscriptions,
			globalInvalidation,
			auditService,
			routeGate,
			lifecycle,
			switchOff,
		);
		const moduleConfigMutations = new ModuleConfigMutationRegistryService();
		moduleConfigMutations.register<UpdateMcpConfigDto>(MCP_MODULE_NAME, (update, commit) =>
			moduleConfigMutation.update(update, commit),
		);
		const updateOAuth = (oauthEnabled: boolean): Promise<void> =>
			moduleConfigMutations.execute(
				MCP_MODULE_NAME,
				Object.assign(new UpdateMcpConfigDto(), { oauth_enabled: oauthEnabled }),
				() => {
					config.oauthEnabled = oauthEnabled;
				},
			);
		const persistGrant = async (providerGrantId: string): Promise<void> => {
			const state = await dataSource
				.getRepository(McpOAuthServerStateEntity)
				.findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY });

			await dataSource.getRepository(McpOAuthGrantEntity).save({
				providerGrantIdHash: hashToken(providerGrantId),
				clientId: client.id,
				approvedById: user.id,
				installationId: INSTALLATION_ID,
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
				oauthEnabledGeneration: state.oauthEnabledGeneration,
				serverSecretVersion: state.serverSecretVersion,
				publicIdentityGeneration: state.publicIdentityGeneration,
				clientGeneration: client.generation,
				modulePolicyGeneration: state.modulePolicyGeneration,
			});
		};

		server.on('request', (request, response) => {
			void dispatchRequest(request, response, runtime, subscriptions, persistGrant, urls).catch((error: unknown) => {
				if (response.headersSent) {
					response.destroy();
					return;
				}

				response.statusCode = 503;
				response.setHeader('content-type', 'application/json');
				response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'temporarily_unavailable' }));
			});
		});
		await lifecycle.activateInternal();
		expect(routeGate.isOpen).toBe(true);

		const armPause = (model: string): ArtifactPause => {
			let signalEntered = (): void => undefined;
			let release = (): void => undefined;
			let armed = true;
			const entered = new Promise<void>((resolve) => {
				signalEntered = resolve;
			});
			const released = new Promise<void>((resolve) => {
				release = resolve;
			});

			beforeArtifactUpsert = async ({ model: candidate }): Promise<void> => {
				if (!armed || candidate !== model) return;

				armed = false;
				signalEntered();
				await released;
			};
			releaseActivePause = release;

			return { entered, release };
		};
		const raceSwitchOff = async <T>(model: string, startHandler: () => Promise<T>): Promise<T> => {
			const pause = armPause(model);
			const handler = startHandler();
			await pause.entered;
			let switchOffSettled = false;
			const disabling = updateOAuth(false).finally(() => {
				switchOffSettled = true;
			});

			await waitFor(() => !routeGate.isOpen);
			expect(await settlesWithin(disabling, 25)).toBe(false);
			expect(switchOffSettled).toBe(false);
			pause.release();
			const result = await handler;
			await disabling;
			beforeArtifactUpsert = () => Promise.resolve();
			expect(config.oauthEnabled).toBe(false);
			expect(routeGate.isOpen).toBe(false);
			expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);

			return result;
		};

		const authorization = await raceSwitchOff('AuthorizationCode', () => authorize(urls));
		const authorizationCode = requireAuthorizationCode(authorization.callback);
		await updateOAuth(true);
		expect((await exchangeCode(urls, authorizationCode, authorization.verifier)).status).toBe(400);

		const exchangeAuthorization = await authorize(urls);
		const exchangeCodeValue = requireAuthorizationCode(exchangeAuthorization.callback);
		const exchangeResponse = await raceSwitchOff('AccessToken', () =>
			exchangeCode(urls, exchangeCodeValue, exchangeAuthorization.verifier),
		);
		const exchangedTokens = (await exchangeResponse.json()) as TokenResponse;
		expect(exchangeResponse.status).toBe(200);
		expect(exchangedTokens.refresh_token).toBeDefined();
		await updateOAuth(true);
		await expect(runtime.getActive().provider.AccessToken.find(exchangedTokens.access_token)).resolves.toBeUndefined();
		expect((await refresh(urls, requireRefreshToken(exchangedTokens))).status).toBe(400);

		const refreshAuthorization = await authorize(urls);
		const initialResponse = await exchangeCode(
			urls,
			requireAuthorizationCode(refreshAuthorization.callback),
			refreshAuthorization.verifier,
		);
		const initialTokens = (await initialResponse.json()) as TokenResponse;
		const refreshResponse = await raceSwitchOff('AccessToken', () => refresh(urls, requireRefreshToken(initialTokens)));
		const refreshedTokens = (await refreshResponse.json()) as TokenResponse;
		expect(refreshResponse.status).toBe(200);
		expect(refreshedTokens.refresh_token).toBeDefined();
		await updateOAuth(true);
		await expect(runtime.getActive().provider.AccessToken.find(refreshedTokens.access_token)).resolves.toBeUndefined();
		expect((await refresh(urls, requireRefreshToken(refreshedTokens))).status).toBe(400);
	} finally {
		releaseActivePause();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await dataSource.destroy();
	}
}

async function dispatchRequest(
	request: IncomingMessage,
	response: ServerResponse,
	runtime: McpOAuthRuntimeService,
	subscriptions: McpSubscriptionRegistryService,
	persistGrant: (providerGrantId: string) => Promise<void>,
	urls: McpOAuthPublicUrls,
): Promise<void> {
	const url = new URL(request.url ?? '/', urls.publicBaseUrl);
	const interactionPrefix = '/api/v1/modules/mcp/oauth/interaction/';

	if (url.pathname.startsWith(interactionPrefix)) {
		const { provider } = runtime.getActive();

		await subscriptions.runOAuthMutation(() => finishInteraction(provider, request, response, persistGrant, urls));
		return;
	}

	request.url = `${url.pathname}${url.search}`;
	runtime.getActive().callback(request, response);
}

async function finishInteraction(
	provider: Provider,
	request: IncomingMessage,
	response: ServerResponse,
	persistGrant: (providerGrantId: string) => Promise<void>,
	urls: McpOAuthPublicUrls,
): Promise<void> {
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

	const grant = new provider.Grant({ accountId: ACCOUNT_ID, clientId: details.params.client_id });
	const promptDetails = isRecord(details.prompt.details) ? details.prompt.details : {};
	const missingResourceScopes = promptDetails.missingResourceScopes;

	if (isRecord(missingResourceScopes)) {
		for (const [resource, scopes] of Object.entries(missingResourceScopes)) {
			if (isStringArray(scopes)) grant.addResourceScope(resource, scopes.join(' '));
		}
	}

	const missingOidcScope = promptDetails.missingOIDCScope;

	if (isStringArray(missingOidcScope)) grant.addOIDCScope(missingOidcScope.join(' '));
	grant.addResourceScope(urls.resource, McpOAuthScope.READ);
	grant.addOIDCScope(McpOAuthScope.OFFLINE_ACCESS);
	const grantId = await grant.save();
	await persistGrant(grantId);
	await provider.interactionFinished(request, response, { consent: { grantId } }, { mergeWithLastSubmission: true });
}

async function authorize(urls: McpOAuthPublicUrls): Promise<{ callback: URL; verifier: string }> {
	const verifier = randomBytes(32).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	const browser = new CookieBrowser();
	let current = new URL(urls.authorizationEndpoint);
	current.search = new URLSearchParams({
		client_id: CLIENT_ID,
		redirect_uri: REDIRECT_URI,
		response_type: 'code',
		scope: `${McpOAuthScope.READ} ${McpOAuthScope.OFFLINE_ACCESS}`,
		code_challenge: challenge,
		code_challenge_method: 'S256',
		resource: urls.resource,
		state: randomBytes(12).toString('base64url'),
		prompt: 'consent',
	}).toString();

	for (let count = 0; count < 10; count += 1) {
		const response = await browser.fetch(current);
		const location = response.headers.get('location');

		if (!location) throw new Error(`Authorization stopped at ${current} with HTTP ${response.status}`);
		const next = new URL(location, current);

		if (next.pathname === '/callback') return { callback: next, verifier };
		current = next;
	}

	throw new Error('Authorization exceeded the redirect limit');
}

function exchangeCode(urls: McpOAuthPublicUrls, code: string, verifier: string): Promise<Response> {
	return fetch(urls.tokenEndpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: REDIRECT_URI,
			resource: urls.resource,
		}),
	});
}

function refresh(urls: McpOAuthPublicUrls, refreshToken: string): Promise<Response> {
	return fetch(urls.tokenEndpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: CLIENT_ID,
			refresh_token: refreshToken,
			resource: urls.resource,
		}),
	});
}

function requireAuthorizationCode(callback: URL): string {
	const code = callback.searchParams.get('code');

	if (!code) throw new Error('Expected an authorization code');

	return code;
}

function requireRefreshToken(tokens: TokenResponse): string {
	if (!tokens.refresh_token) throw new Error('Expected a refresh token');

	return tokens.refresh_token;
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let count = 0; count < 100; count += 1) {
		if (predicate()) return;
		await new Promise<void>((resolve) => setTimeout(resolve, 1));
	}

	throw new Error('Timed out waiting for the OAuth lifecycle transition');
}

async function settlesWithin(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
	return Promise.race([
		promise.then(() => true),
		new Promise<boolean>((resolve) => setTimeout(() => resolve(false), milliseconds)),
	]);
}
