import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';

import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthAuthorizationCodeEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import {
	MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS,
	MCP_OAUTH_GRANT_LIFETIME_MS,
	MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS,
	MCP_OAUTH_SERVER_STATE_KEY,
	McpOAuthScope,
} from '../mcp.constants';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthPublicUrlService } from './mcp-oauth-public-url.service';

export interface McpOAuthRawArtifact<TEntity> {
	rawValue: string;
	artifact: TEntity;
}

@Injectable()
export class McpOAuthArtifactService {
	constructor(
		@InjectRepository(McpOAuthClientEntity)
		private readonly clients: Repository<McpOAuthClientEntity>,
		@InjectRepository(McpOAuthGrantEntity)
		private readonly grants: Repository<McpOAuthGrantEntity>,
		@InjectRepository(McpOAuthInteractionEntity)
		private readonly interactions: Repository<McpOAuthInteractionEntity>,
		@InjectRepository(McpOAuthAuthorizationCodeEntity)
		private readonly authorizationCodes: Repository<McpOAuthAuthorizationCodeEntity>,
		@InjectRepository(McpOAuthAccessTokenEntity)
		private readonly accessTokens: Repository<McpOAuthAccessTokenEntity>,
		@InjectRepository(McpOAuthRefreshTokenFamilyEntity)
		private readonly refreshFamilies: Repository<McpOAuthRefreshTokenFamilyEntity>,
		@InjectRepository(McpOAuthServerStateEntity)
		private readonly serverState: Repository<McpOAuthServerStateEntity>,
		private readonly installationService: McpInstallationService,
		private readonly publicUrlService: McpOAuthPublicUrlService,
	) {}

	async createClient(input: {
		name: string;
		redirectUris: string[];
		maximumScopes: McpOAuthScope[];
		createdById: string;
	}): Promise<McpOAuthClientEntity> {
		return this.clients.save(
			this.clients.create({
				clientIdentifier: this.generateOpaqueValue(16),
				name: input.name,
				redirectUris: [...input.redirectUris],
				maximumScopes: [...input.maximumScopes],
				enabled: true,
				generation: 0,
				createdById: input.createdById,
			}),
		);
	}

	async createGrant(input: {
		providerGrantId: string;
		clientId: string;
		approvedById: string;
		approvedScopes: McpOAuthScope[];
		expiresAt?: Date;
		approverAuthorityGeneration?: number;
	}): Promise<McpOAuthGrantEntity> {
		const urls = this.requirePublicUrls();
		const maximumExpiry = new Date(Date.now() + MCP_OAUTH_GRANT_LIFETIME_MS);
		const expiresAt = this.earliest(input.expiresAt, maximumExpiry);
		const [client, serverState] = await Promise.all([
			this.clients.findOneBy({ id: input.clientId, enabled: true }),
			this.serverState.findOneBy({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		]);

		if (expiresAt <= new Date()) {
			throw new BadRequestException('OAuth grant expiry must be in the future');
		}
		if (!client) {
			throw new BadRequestException('OAuth grant client is no longer active');
		}
		if (!serverState) {
			throw new ServiceUnavailableException('MCP OAuth authorization generation state is unavailable');
		}

		return this.grants.save(
			this.grants.create({
				providerGrantIdHash: hashToken(input.providerGrantId),
				clientId: input.clientId,
				approvedById: input.approvedById,
				installationId: await this.installationService.getInstallationId(),
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [...input.approvedScopes],
				expiresAt,
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: input.approverAuthorityGeneration ?? 0,
				oauthEnabledGeneration: serverState.oauthEnabledGeneration,
				serverSecretVersion: serverState.serverSecretVersion,
				publicIdentityGeneration: serverState.publicIdentityGeneration,
				clientGeneration: client.generation,
				modulePolicyGeneration: serverState.modulePolicyGeneration,
			}),
		);
	}

	async createInteraction(input: {
		clientId: string;
		redirectUri: string;
		requestedScopes: McpOAuthScope[];
		expiresAt: Date;
	}): Promise<McpOAuthRawArtifact<McpOAuthInteractionEntity>> {
		const rawValue = this.generateOpaqueValue();
		const artifact = await this.interactions.save(
			this.interactions.create({
				uidHash: hashToken(rawValue),
				clientId: input.clientId,
				authenticatedUserId: null,
				redirectUri: input.redirectUri,
				requestedScopes: [...input.requestedScopes],
				expiresAt: input.expiresAt,
				consumedAt: null,
			}),
		);

		return { rawValue, artifact };
	}

	async issueAuthorizationCode(input: {
		clientId: string;
		grant: McpOAuthGrantEntity;
		interactionId: string;
		redirectUri: string;
		scopes: McpOAuthScope[];
		codeChallenge: string;
		expiresAt: Date;
	}): Promise<McpOAuthRawArtifact<McpOAuthAuthorizationCodeEntity>> {
		const rawValue = this.generateOpaqueValue();
		const artifact = await this.authorizationCodes.save(
			this.authorizationCodes.create({
				codeHash: hashToken(rawValue),
				clientId: input.clientId,
				grantId: input.grant.id,
				interactionId: input.interactionId,
				installationId: input.grant.installationId,
				issuer: input.grant.issuer,
				resource: input.grant.resource,
				redirectUri: input.redirectUri,
				scopes: [...input.scopes],
				codeChallenge: input.codeChallenge,
				expiresAt: input.expiresAt,
				consumedAt: null,
			}),
		);

		return { rawValue, artifact };
	}

	async issueAccessToken(input: {
		clientId: string;
		grant: McpOAuthGrantEntity;
		scopes: McpOAuthScope[];
		refreshFamilyId?: string;
		expiresAt?: Date;
	}): Promise<McpOAuthRawArtifact<McpOAuthAccessTokenEntity>> {
		this.assertGrantActive(input.grant);
		const rawValue = this.generateOpaqueValue();
		const maximumExpiry = new Date(Date.now() + MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS);
		const artifact = await this.accessTokens.save(
			this.accessTokens.create({
				tokenHash: hashToken(rawValue),
				clientId: input.clientId,
				grantId: input.grant.id,
				refreshFamilyId: input.refreshFamilyId ?? null,
				installationId: input.grant.installationId,
				issuer: input.grant.issuer,
				resource: input.grant.resource,
				scopes: [...input.scopes],
				expiresAt: this.earliest(input.expiresAt, maximumExpiry, input.grant.expiresAt),
				revokedAt: null,
			}),
		);

		return { rawValue, artifact };
	}

	async issueRefreshFamily(input: { clientId: string; grant: McpOAuthGrantEntity; expiresAt?: Date }): Promise<{
		family: McpOAuthRefreshTokenFamilyEntity;
		refreshToken: McpOAuthRawArtifact<McpOAuthRefreshTokenEntity>;
	}> {
		this.assertGrantActive(input.grant);
		const maximumExpiry = new Date(Date.now() + MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS);
		const expiresAt = this.earliest(input.expiresAt, maximumExpiry, input.grant.expiresAt);

		return this.refreshFamilies.manager.transaction(async (manager) => {
			const familyRepository = manager.getRepository(McpOAuthRefreshTokenFamilyEntity);
			const tokenRepository = manager.getRepository(McpOAuthRefreshTokenEntity);
			const family = await familyRepository.save(
				familyRepository.create({
					clientId: input.clientId,
					grantId: input.grant.id,
					installationId: input.grant.installationId,
					expiresAt,
					revokedAt: null,
					revocationReason: null,
					generation: 0,
				}),
			);
			const rawValue = this.generateOpaqueValue();
			const artifact = await tokenRepository.save(
				tokenRepository.create({
					tokenHash: hashToken(rawValue),
					familyId: family.id,
					predecessorId: null,
					expiresAt,
					consumedAt: null,
					revokedAt: null,
				}),
			);

			return { family, refreshToken: { rawValue, artifact } };
		});
	}

	private requirePublicUrls() {
		const urls = this.publicUrlService.getUrls();

		if (!urls) {
			throw new ServiceUnavailableException('MCP OAuth public URL is not configured');
		}

		return urls;
	}

	private generateOpaqueValue(bytes = 32): string {
		return randomBytes(bytes).toString('base64url');
	}

	private earliest(...values: Array<Date | undefined>): Date {
		return new Date(
			Math.min(...values.filter((value): value is Date => value !== undefined).map((value) => value.getTime())),
		);
	}

	private assertGrantActive(grant: McpOAuthGrantEntity): void {
		if (grant.revokedAt || grant.expiresAt <= new Date()) {
			throw new BadRequestException('OAuth grant is revoked or expired');
		}
	}
}
