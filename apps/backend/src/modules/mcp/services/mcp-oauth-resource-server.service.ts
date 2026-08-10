import { Repository } from 'typeorm';

import {
	AuthInfo,
	OAuthError,
	OAuthErrorCode,
	OAuthProtectedResourceMetadata,
	OAuthTokenVerifier,
	bearerAuthChallengeResponse,
	buildOAuthProtectedResourceMetadata,
	verifyBearerToken,
} from '@modelcontextprotocol/server';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import { ConfigService } from '../../config/services/config.service';
import { UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import {
	MCP_MODULE_NAME,
	MCP_OAUTH_PRINCIPAL_TYPE,
	MCP_OAUTH_SERVER_STATE_KEY,
	McpCapability,
	McpOAuthScope,
} from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import {
	McpOAuthAuthorizationServerMetadata,
	buildMcpOAuthAuthorizationServerMetadata,
} from '../oauth/mcp-oauth-metadata';
import { toMcpOAuthScope } from '../oauth/mcp-oauth-scope.utils';
import { McpOAuthPrincipal, McpOAuthPublicUrls } from '../oauth/mcp-oauth.types';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthPublicUrlService } from './mcp-oauth-public-url.service';

interface ProviderAccessTokenPayload {
	accountId?: unknown;
	aud?: unknown;
	clientId?: unknown;
	grantId?: unknown;
	scope?: unknown;
}

export interface McpOAuthAuthorizationContext {
	client: { id: string };
	effectiveCapabilities: McpCapability[];
	installationId: string;
	tokenId: string;
}

@Injectable()
export class McpOAuthResourceServerService implements OAuthTokenVerifier {
	constructor(
		@InjectRepository(McpOAuthProviderArtifactEntity)
		private readonly artifactRepository: Repository<McpOAuthProviderArtifactEntity>,
		@InjectRepository(McpOAuthProviderRevokedGrantEntity)
		private readonly revokedGrantRepository: Repository<McpOAuthProviderRevokedGrantEntity>,
		@InjectRepository(McpOAuthGrantEntity)
		private readonly grantRepository: Repository<McpOAuthGrantEntity>,
		@InjectRepository(McpOAuthApproverAuthorityEntity)
		private readonly approverAuthorities: Repository<McpOAuthApproverAuthorityEntity>,
		@InjectRepository(McpOAuthServerStateEntity)
		private readonly serverStateRepository: Repository<McpOAuthServerStateEntity>,
		private readonly configService: ConfigService,
		private readonly installationService: McpInstallationService,
		private readonly publicUrlService: McpOAuthPublicUrlService,
	) {}

	getAuthorizationServerMetadata(): McpOAuthAuthorizationServerMetadata {
		return buildMcpOAuthAuthorizationServerMetadata(this.requireUrls());
	}

	getProtectedResourceMetadata(): OAuthProtectedResourceMetadata {
		const urls = this.requireUrls();

		return buildOAuthProtectedResourceMetadata({
			oauthMetadata: this.getAuthorizationServerMetadata(),
			resourceServerUrl: new URL(urls.resource),
			resourceName: 'FastyBird Smart Panel MCP',
			scopesSupported: Object.values(McpOAuthScope).filter((scope) => scope !== McpOAuthScope.OFFLINE_ACCESS),
		});
	}

	getResourceMetadataUrl(): string {
		return this.requireUrls().protectedResourceMetadata;
	}

	async verifyAccessToken(token: string): Promise<AuthInfo> {
		const tokenId = hashToken(token);
		const artifact = await this.artifactRepository.findOneBy({ model: 'AccessToken', idHash: tokenId });

		if (!artifact || artifact.expiresAt === null || artifact.expiresAt <= Date.now() || !artifact.grantIdHash) {
			this.invalidToken();
		}

		const payload = this.parsePayload(artifact.payload);

		if (typeof payload.grantId !== 'string' || hashToken(payload.grantId) !== artifact.grantIdHash) {
			this.invalidToken();
		}

		const [revokedGrant, grant, serverState] = await Promise.all([
			this.revokedGrantRepository.findOneBy({ grantIdHash: artifact.grantIdHash }),
			this.grantRepository.findOne({
				where: { providerGrantIdHash: artifact.grantIdHash },
				relations: { approvedBy: true, client: true },
			}),
			this.serverStateRepository.findOneBy({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		]);
		const approverAuthority = grant?.approvedById
			? await this.approverAuthorities.findOneBy({ approverId: grant.approvedById })
			: null;
		const urls = this.requireUrls();
		const installationId = await this.installationService.getInstallationId();
		const config = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME);

		if (
			revokedGrant ||
			!grant ||
			!grant.client ||
			!serverState ||
			artifact.oauthEnabledGeneration !== serverState?.oauthEnabledGeneration ||
			artifact.serverSecretVersion !== serverState?.serverSecretVersion ||
			artifact.publicIdentityGeneration !== serverState?.publicIdentityGeneration ||
			artifact.modulePolicyGeneration !== serverState?.modulePolicyGeneration ||
			artifact.clientGeneration !== grant?.client?.generation ||
			artifact.grantGeneration !== grant?.generation ||
			artifact.approverAuthorityGeneration !== (approverAuthority?.generation ?? 0) ||
			grant.oauthEnabledGeneration !== serverState?.oauthEnabledGeneration ||
			grant.serverSecretVersion !== serverState?.serverSecretVersion ||
			grant.publicIdentityGeneration !== serverState?.publicIdentityGeneration ||
			grant.clientGeneration !== grant.client.generation ||
			grant.modulePolicyGeneration !== serverState?.modulePolicyGeneration ||
			!grant.client.enabled ||
			!grant.approvedBy ||
			!grant.approvedById ||
			grant.approverAuthorityGeneration !== (approverAuthority?.generation ?? 0) ||
			![UserRole.OWNER, UserRole.ADMIN].includes(grant.approvedBy.role) ||
			grant.revokedAt !== null ||
			grant.expiresAt <= new Date() ||
			grant.issuer !== urls.issuer ||
			grant.resource !== urls.resource ||
			grant.installationId !== installationId ||
			payload.aud !== urls.resource ||
			payload.clientId !== grant.client.clientIdentifier ||
			payload.accountId !== grant.approvedById ||
			!config.enabled
		) {
			this.invalidToken();
		}

		const tokenScopes = this.parseScopes(payload.scope);
		const effectiveCapabilities = this.intersectCapabilities(
			config.capabilities,
			grant.client.maximumScopes,
			grant.approvedScopes,
			tokenScopes,
		);
		const effectiveScopes = effectiveCapabilities.map(toMcpOAuthScope);
		const authorizationDeadline = Math.min(artifact.expiresAt, grant.expiresAt.getTime());
		const principal: McpOAuthPrincipal = {
			type: MCP_OAUTH_PRINCIPAL_TYPE,
			accessTokenId: artifact.managementId,
			approverAuthorityGeneration: grant.approverAuthorityGeneration,
			approverId: grant.approvedById,
			authorizationDeadline,
			clientId: grant.client.id,
			clientGeneration: grant.client.generation,
			effectiveScopes,
			grantId: grant.id,
			grantGeneration: grant.generation,
			installationId,
			modulePolicyGeneration: serverState.modulePolicyGeneration,
			...(artifact.refreshFamilyId ? { refreshFamilyId: artifact.refreshFamilyId } : {}),
			scopes: tokenScopes,
			effectiveCapabilities,
		};

		return {
			token,
			clientId: grant.client.clientIdentifier,
			scopes: effectiveScopes,
			expiresAt: Math.floor(authorizationDeadline / 1_000),
			resource: new URL(urls.resource),
			extra: { principal, installationId, tokenId },
		};
	}

	async verifyMcpBearerToken(
		authorizationHeader: string | null | undefined,
		requiredCapabilities: McpCapability[] = [],
	): Promise<AuthInfo> {
		const authInfo = await verifyBearerToken(authorizationHeader, {
			verifier: this,
			requiredScopes: requiredCapabilities.map(toMcpOAuthScope),
			resourceMetadataUrl: this.getResourceMetadataUrl(),
		});
		const principal = this.getPrincipal(authInfo);

		return { ...authInfo, scopes: [...principal.effectiveCapabilities] };
	}

	getBearerChallenge(error: unknown, requiredCapabilities: McpCapability[] = []): Response {
		return bearerAuthChallengeResponse(error, {
			requiredScopes: requiredCapabilities.map(toMcpOAuthScope),
			resourceMetadataUrl: this.getResourceMetadataUrl(),
		});
	}

	async authorizeAccessToken(token: string, capability: McpCapability): Promise<McpOAuthAuthorizationContext> {
		const authInfo = await this.verifyAccessToken(token);
		const principal = this.getPrincipal(authInfo);

		if (!principal.effectiveCapabilities.includes(capability)) {
			throw new OAuthError(OAuthErrorCode.InsufficientScope, `MCP scope '${toMcpOAuthScope(capability)}' is required`);
		}

		return {
			client: { id: principal.clientId },
			effectiveCapabilities: principal.effectiveCapabilities,
			installationId: principal.installationId,
			tokenId: principal.accessTokenId,
		};
	}

	private getPrincipal(authInfo: AuthInfo): McpOAuthPrincipal {
		const principal = authInfo.extra?.principal as McpOAuthPrincipal | undefined;

		if (principal?.type !== MCP_OAUTH_PRINCIPAL_TYPE) this.invalidToken();

		return principal;
	}

	private intersectCapabilities(
		moduleCapabilities: McpCapability[],
		clientScopes: McpOAuthScope[],
		grantScopes: McpOAuthScope[],
		tokenScopes: McpOAuthScope[],
	): McpCapability[] {
		return moduleCapabilities.filter((capability) => {
			const scope = toMcpOAuthScope(capability);

			return clientScopes.includes(scope) && grantScopes.includes(scope) && tokenScopes.includes(scope);
		});
	}

	private parsePayload(value: string): ProviderAccessTokenPayload {
		try {
			const payload = JSON.parse(value) as unknown;

			if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) this.invalidToken();

			return payload as ProviderAccessTokenPayload;
		} catch (error) {
			if (OAuthError.isInstance(error)) throw error;

			this.invalidToken();
		}
	}

	private parseScopes(value: unknown): McpOAuthScope[] {
		if (typeof value !== 'string') this.invalidToken();

		const scopes = [...new Set(value.split(' ').filter(Boolean))];
		const knownScopes = new Set<string>(Object.values(McpOAuthScope));

		if (scopes.length === 0 || scopes.some((scope) => !knownScopes.has(scope))) this.invalidToken();

		return scopes as McpOAuthScope[];
	}

	private requireUrls(): McpOAuthPublicUrls {
		const urls = this.publicUrlService.getUrls();

		if (!urls) throw new ServiceUnavailableException('MCP OAuth public URL is not configured');

		return urls;
	}

	private invalidToken(): never {
		throw new OAuthError(OAuthErrorCode.InvalidToken, 'The MCP OAuth access token is invalid or no longer active');
	}
}
