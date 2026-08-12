import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type Provider from 'oidc-provider';
import type { JWK } from 'oidc-provider';
import { DataSource } from 'typeorm';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
	MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS,
	MCP_OAUTH_GRANT_LIFETIME_MS,
	MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS,
	McpOAuthScope,
} from '../mcp.constants';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';
import {
	McpOAuthEndpointRateLimitService,
	McpOAuthRateLimitedEndpoint,
} from '../services/mcp-oauth-endpoint-rate-limit.service';
import { McpOAuthProviderMaterialService } from '../services/mcp-oauth-provider-material.service';
import { McpOAuthPublicUrlService } from '../services/mcp-oauth-public-url.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';
import { McpSubscriptionRegistryService } from '../services/mcp-subscription-registry.service';

import { McpOAuthAuthorizationServerMetadata, buildMcpOAuthAuthorizationServerMetadata } from './mcp-oauth-metadata';
import { type McpOAuthProviderAdapterOptions, createMcpOAuthProviderAdapter } from './mcp-oauth-provider.adapter';
import { loadMcpOAuthProvider } from './mcp-oauth-provider.loader';
import { McpOAuthPublicUrls } from './mcp-oauth.types';

const toSeconds = (milliseconds: number): number => Math.floor(milliseconds / 1_000);

export interface McpOAuthProviderRuntime {
	provider: Provider;
	callback: RequestListener;
	urls: McpOAuthPublicUrls;
	metadata: McpOAuthAuthorizationServerMetadata;
}

export interface McpOAuthProviderFactoryOptions {
	allowTestInMemory?: boolean;
	allowInsecureTestCookies?: boolean;
	artifactLifecycleHook?: McpOAuthProviderAdapterOptions['artifactLifecycleHook'];
	beforeArtifactUpsert?: McpOAuthProviderAdapterOptions['beforeArtifactUpsert'];
	cookieKeys?: string[];
	interactionUrl?: (uid: string) => string;
	jwks?: { keys: JWK[] };
}

@Injectable()
export class McpOAuthProviderFactory {
	constructor(
		private readonly dataSource: DataSource,
		private readonly clientsService: McpOAuthClientService,
		private readonly publicUrlService: McpOAuthPublicUrlService,
		private readonly providerMaterial: McpOAuthProviderMaterialService,
		private readonly subscriptions: McpSubscriptionRegistryService,
		private readonly endpointRateLimit: McpOAuthEndpointRateLimitService,
		private readonly routeGate: McpOAuthRouteGateService,
	) {}

	async create(options: McpOAuthProviderFactoryOptions = {}): Promise<McpOAuthProviderRuntime> {
		const urls = this.publicUrlService.getUrls();

		if (!urls) {
			throw new ServiceUnavailableException('MCP OAuth public URL is not configured');
		}

		const persistentMaterial =
			process.env.NODE_ENV !== 'test' && (!options.cookieKeys || !options.jwks) ? this.providerMaterial.get() : null;
		const cookieKeys = options.cookieKeys ?? persistentMaterial?.cookieKeys;
		const jwks = options.jwks ?? persistentMaterial?.jwks;

		if (process.env.NODE_ENV !== 'test' && options.allowInsecureTestCookies === true) {
			throw new ServiceUnavailableException('Insecure MCP OAuth cookies are permitted only by explicit test setups');
		}

		const oidcProvider = await loadMcpOAuthProvider();
		const testPrivateKey = jwks
			? null
			: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'jwk' });
		const adapter = createMcpOAuthProviderAdapter(this.dataSource, this.clientsService, {
			allowTestInMemory: options.allowTestInMemory,
			artifactReuseError: () => new oidcProvider.errors.InvalidGrant('OAuth artifact already used'),
			artifactLifecycleHook: options.artifactLifecycleHook,
			beforeArtifactUpsert: options.beforeArtifactUpsert,
		});
		const provider = new oidcProvider.default(urls.issuer, {
			adapter,
			routes: {
				authorization: new URL(urls.authorizationEndpoint).pathname,
				token: new URL(urls.tokenEndpoint).pathname,
				revocation: new URL(urls.revocationEndpoint).pathname,
			},
			clientAuthMethods: ['none'],
			responseTypes: ['code'],
			// Capability scopes belong to the MCP resource server. Keeping them out of the provider's OIDC scope set
			// makes oidc-provider evaluate them as resource scopes instead of requesting a second consent prompt.
			scopes: [McpOAuthScope.OFFLINE_ACCESS],
			extraParams: {
				state: async (context, state) => {
					if (context.oidc.route === 'authorization' && !state) {
						throw new oidcProvider.errors.InvalidRequest('The OAuth state parameter is required');
					}

					if (context.oidc.route !== 'authorization') return;

					const clientIdentifier = context.oidc.params.client_id;
					const registeredClient =
						typeof clientIdentifier === 'string'
							? await this.clientsService.findActiveByIdentifier(clientIdentifier)
							: null;

					if (!registeredClient) return;

					const requestedScope = context.oidc.params.scope;

					if (!requestedScope) {
						// OAuth permits clients to omit scope. Default only capability scopes; renewable access continues
						// to require an explicit offline_access request as well as owner/admin consent.
						context.oidc.params.scope = registeredClient.maximumScopes
							.filter((scope) => scope !== McpOAuthScope.OFFLINE_ACCESS)
							.join(' ');
						return;
					}

					if (typeof requestedScope !== 'string') return;

					const disallowedScopes = requestedScope
						.split(' ')
						.filter((scope) => !registeredClient.maximumScopes.includes(scope as McpOAuthScope));

					if (disallowedScopes.length > 0) {
						throw new oidcProvider.errors.InvalidScope('requested scope is not allowed', disallowedScopes.join(' '));
					}
				},
			},
			allowOmittingSingleRegisteredRedirectUri: false,
			acceptQueryParamAccessTokens: false,
			cookies: {
				keys: cookieKeys ?? [randomBytes(32).toString('base64url')],
				long: {
					httpOnly: true,
					sameSite: 'lax',
					path: '/',
					secure: options.allowInsecureTestCookies !== true,
				},
				short: {
					httpOnly: true,
					sameSite: 'lax',
					path: '/',
					secure: options.allowInsecureTestCookies !== true,
				},
			},
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
				revocation: {
					enabled: true,
					allowedPolicy: (_context, client, token) => token.clientId === client.clientId,
				},
				resourceIndicators: {
					enabled: true,
					defaultResource: () => {
						throw new oidcProvider.errors.InvalidTarget('The MCP resource parameter is required');
					},
					useGrantedResource: () => false,
					getResourceServerInfo: (context, requestedResource) => {
						if (requestedResource !== urls.resource) {
							throw new oidcProvider.errors.InvalidTarget('The MCP resource does not match this installation');
						}

						const grantExpiresAt = context.oidc.entities.Grant?.exp;
						const remainingGrantLifetime =
							typeof grantExpiresAt === 'number'
								? Math.max(1, grantExpiresAt - Math.floor(Date.now() / 1_000))
								: undefined;

						return {
							scope: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.TRIGGER].join(' '),
							audience: urls.resource,
							accessTokenTTL: Math.min(
								toSeconds(MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS),
								remainingGrantLifetime ?? Number.POSITIVE_INFINITY,
							),
							accessTokenFormat: 'opaque',
						};
					},
				},
			},
			pkce: { required: () => true },
			issueRefreshToken: (_context, _client, code) => code.scopes.has(McpOAuthScope.OFFLINE_ACCESS),
			rotateRefreshToken: true,
			renderError: (context, out) => {
				context.status = 400;
				context.type = 'application/json';
				context.body = {
					error: out.error,
					...(out.error_description ? { error_description: out.error_description } : {}),
				};
			},
			interactions: {
				url: (_context, interaction) =>
					options.interactionUrl?.(interaction.uid) ??
					`${urls.publicBaseUrl}/mcp-oauth-consent?interaction=${encodeURIComponent(interaction.uid)}`,
			},
			findAccount: (_context, accountId) => ({
				accountId,
				claims: () => ({ sub: accountId }),
			}),
			loadExistingGrant: (context) => {
				const consentGrantId = context.oidc.result?.consent?.grantId;

				return consentGrantId ? context.oidc.provider.Grant.find(consentGrantId) : undefined;
			},
			ttl: {
				AccessToken: toSeconds(MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS),
				AuthorizationCode: 60,
				RefreshToken: (context, refreshToken) => {
					const grantExpiresAt = context.oidc.entities.Grant?.exp;
					const remainingGrantLifetime =
						typeof grantExpiresAt === 'number'
							? Math.max(1, grantExpiresAt - Math.floor(Date.now() / 1_000))
							: Number.POSITIVE_INFINITY;
					// The provider stores the original family issue time at whole-second precision. Subtract one
					// second so millisecond rounding in the adapter can never extend a successor past that boundary.
					const remainingFamilyLifetime = Math.max(
						1,
						toSeconds(MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS) - refreshToken.totalLifetime() - 1,
					);

					return Math.min(remainingFamilyLifetime, remainingGrantLifetime);
				},
				Grant: toSeconds(MCP_OAUTH_GRANT_LIFETIME_MS),
				Interaction: 10 * 60,
				Session: 30 * 60,
			},
			jwks:
				jwks ??
				({ keys: [{ ...testPrivateKey, use: 'sig', alg: 'RS256', kid: 'mcp-oauth-internal-test' }] } as {
					keys: JWK[];
				}),
		});
		// The bootstrap gate rejects forwarded headers unless the immediate peer is explicitly trusted. Once a request
		// passes that boundary, let Koa honor X-Forwarded-Proto so secure OAuth cookies work behind the supported TLS
		// reverse-proxy topology.
		provider.proxy = true;

		const providerCallback = provider.callback();
		const callback: RequestListener = (request, response) => {
			void this.dispatchProviderRequest(request, response, providerCallback, urls).catch(() => {
				if (response.headersSent) {
					response.destroy();
					return;
				}

				response.statusCode = 500;
				response.setHeader('content-type', 'application/json');
				response.setHeader('cache-control', 'no-store');
				response.end(JSON.stringify({ error: 'server_error' }));
			});
		};

		return { provider, callback, urls, metadata: buildMcpOAuthAuthorizationServerMetadata(urls) };
	}

	assertTokenRequestResource(parameters: URLSearchParams): void {
		const grantType = parameters.get('grant_type');

		if ((grantType === 'authorization_code' || grantType === 'refresh_token') && !parameters.get('resource')) {
			throw new Error('invalid_target: The MCP resource parameter is required at the token endpoint');
		}
	}

	private async dispatchProviderRequest(
		request: IncomingMessage,
		response: ServerResponse,
		providerCallback: (request: IncomingMessage, response: ServerResponse) => Promise<void>,
		urls: McpOAuthPublicUrls,
	): Promise<void> {
		const pathname = new URL(request.url ?? '/', urls.issuer).pathname;
		const tokenPathname = new URL(urls.tokenEndpoint).pathname;
		const rateLimitedEndpoint = this.getRateLimitedEndpoint(pathname, urls);
		const routeGeneration = this.routeGate.assertOpen();

		if (rateLimitedEndpoint) {
			const decision = await this.endpointRateLimit.consume(rateLimitedEndpoint, request.socket?.remoteAddress);

			if (!decision.allowed) {
				this.writeRateLimitError(request, response, decision.retryAfterSeconds);
				return;
			}
		}

		if (request.method === 'POST' && (pathname === tokenPathname || pathname === '/token')) {
			const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();

			if (contentType === 'application/x-www-form-urlencoded') {
				const rawBody = await this.readRequestBody(request);
				(request as IncomingMessage & { body?: string }).body = rawBody;

				try {
					this.assertTokenRequestResource(new URLSearchParams(rawBody));
				} catch {
					this.writeBoundaryError(
						response,
						'invalid_target',
						'The MCP resource parameter is required at the token endpoint',
					);
					return;
				}
			}
		}

		await this.subscriptions.runOAuthMutation(async () => {
			if (this.isDisconnected(request, response)) return;
			this.routeGate.assertOpenGeneration(routeGeneration);

			await providerCallback(request, response);
		});
	}

	private isDisconnected(request: IncomingMessage, response: ServerResponse): boolean {
		return request.aborted || response.destroyed || response.closed || response.writableEnded;
	}

	private async readRequestBody(request: IncomingMessage): Promise<string> {
		const chunks: Buffer[] = [];
		let length = 0;

		for await (const chunk of request) {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
			length += buffer.length;

			if (length > 56 * 1_024) {
				throw new Error('OAuth token request body exceeds the supported limit');
			}
			chunks.push(buffer);
		}

		return Buffer.concat(chunks).toString('utf8');
	}

	private writeBoundaryError(response: ServerResponse, error: string, description: string): void {
		response.statusCode = 400;
		response.setHeader('content-type', 'application/json');
		response.setHeader('cache-control', 'no-store');
		response.setHeader('pragma', 'no-cache');
		response.end(JSON.stringify({ error, error_description: description }));
	}

	private getRateLimitedEndpoint(pathname: string, urls: McpOAuthPublicUrls): McpOAuthRateLimitedEndpoint | null {
		if (
			pathname === new URL(urls.authorizationEndpoint).pathname ||
			pathname === '/authorize' ||
			pathname === '/auth' ||
			pathname.startsWith('/auth/')
		) {
			return McpOAuthRateLimitedEndpoint.AUTHORIZE;
		}
		if (pathname === new URL(urls.tokenEndpoint).pathname || pathname === '/token') {
			return McpOAuthRateLimitedEndpoint.TOKEN;
		}
		if (pathname === new URL(urls.revocationEndpoint).pathname || pathname === '/token/revocation') {
			return McpOAuthRateLimitedEndpoint.REVOCATION;
		}

		return null;
	}

	private writeRateLimitError(request: IncomingMessage, response: ServerResponse, retryAfterSeconds: number): void {
		response.statusCode = 429;
		response.setHeader('content-type', 'application/json');
		response.setHeader('cache-control', 'no-store');
		response.setHeader('pragma', 'no-cache');
		response.setHeader('retry-after', retryAfterSeconds.toString());
		response.setHeader('connection', 'close');
		response.end(
			JSON.stringify({ error: 'temporarily_unavailable', error_description: 'Too many OAuth requests' }),
			() => request.destroy(),
		);
	}
}
