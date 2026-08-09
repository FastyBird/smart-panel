import { generateKeyPairSync, randomBytes } from 'node:crypto';
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
import { McpOAuthPublicUrlService } from '../services/mcp-oauth-public-url.service';

import { createMcpOAuthProviderAdapter } from './mcp-oauth-provider.adapter';
import { loadMcpOAuthProvider } from './mcp-oauth-provider.loader';
import { McpOAuthPublicUrls } from './mcp-oauth.types';

const toSeconds = (milliseconds: number): number => Math.floor(milliseconds / 1_000);

export interface McpOAuthAuthorizationServerMetadata {
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

export interface McpOAuthProviderRuntime {
	provider: Provider;
	urls: McpOAuthPublicUrls;
	metadata: McpOAuthAuthorizationServerMetadata;
}

export interface McpOAuthProviderFactoryOptions {
	allowTestInMemory?: boolean;
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
	) {}

	async create(options: McpOAuthProviderFactoryOptions = {}): Promise<McpOAuthProviderRuntime> {
		const urls = this.publicUrlService.getUrls();

		if (!urls) {
			throw new ServiceUnavailableException('MCP OAuth public URL is not configured');
		}

		if (process.env.NODE_ENV !== 'test' && (!options.cookieKeys?.length || !options.jwks?.keys.length)) {
			throw new ServiceUnavailableException('Persistent MCP OAuth cookie and signing keys are not available');
		}

		const oidcProvider = await loadMcpOAuthProvider();
		const testPrivateKey = options.jwks
			? null
			: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'jwk' });
		const adapter = createMcpOAuthProviderAdapter(this.dataSource, this.clientsService, {
			allowTestInMemory: options.allowTestInMemory,
			artifactReuseError: () => new oidcProvider.errors.InvalidGrant('OAuth artifact already used'),
		});
		const provider = new oidcProvider.default(urls.issuer, {
			adapter,
			clientAuthMethods: ['none'],
			responseTypes: ['code'],
			scopes: Object.values(McpOAuthScope),
			allowOmittingSingleRegisteredRedirectUri: false,
			acceptQueryParamAccessTokens: false,
			cookies: {
				keys: options.cookieKeys ?? [randomBytes(32).toString('base64url')],
				long: { httpOnly: true, sameSite: 'lax', path: '/' },
				short: { httpOnly: true, sameSite: 'lax', path: '/' },
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
				RefreshToken: (context) => {
					const grantExpiresAt = context.oidc.entities.Grant?.exp;
					const remainingGrantLifetime =
						typeof grantExpiresAt === 'number'
							? Math.max(1, grantExpiresAt - Math.floor(Date.now() / 1_000))
							: Number.POSITIVE_INFINITY;

					return Math.min(toSeconds(MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS), remainingGrantLifetime);
				},
				Grant: toSeconds(MCP_OAUTH_GRANT_LIFETIME_MS),
				Interaction: 10 * 60,
				Session: 30 * 60,
			},
			jwks:
				options.jwks ??
				({ keys: [{ ...testPrivateKey, use: 'sig', alg: 'RS256', kid: 'mcp-oauth-internal-test' }] } as {
					keys: JWK[];
				}),
		});

		return { provider, urls, metadata: this.projectMetadata(urls) };
	}

	assertTokenRequestResource(parameters: URLSearchParams): void {
		const grantType = parameters.get('grant_type');

		if ((grantType === 'authorization_code' || grantType === 'refresh_token') && !parameters.has('resource')) {
			throw new Error('invalid_target: The MCP resource parameter is required at the token endpoint');
		}
	}

	assertAuthorizationRequest(parameters: URLSearchParams): void {
		if (!parameters.get('state')) {
			throw new Error('invalid_request: The OAuth state parameter is required');
		}
		if (!parameters.get('resource')) {
			throw new Error('invalid_target: The MCP resource parameter is required');
		}
	}

	private projectMetadata(urls: McpOAuthPublicUrls): McpOAuthAuthorizationServerMetadata {
		return {
			issuer: urls.issuer,
			authorization_endpoint: urls.authorizationEndpoint,
			token_endpoint: urls.tokenEndpoint,
			revocation_endpoint: urls.revocationEndpoint,
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			code_challenge_methods_supported: ['S256'],
			scopes_supported: Object.values(McpOAuthScope),
			token_endpoint_auth_methods_supported: ['none'],
			authorization_response_iss_parameter_supported: true,
		};
	}
}
