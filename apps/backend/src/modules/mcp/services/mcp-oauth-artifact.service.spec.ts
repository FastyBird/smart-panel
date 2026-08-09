import { DataSource } from 'typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
import { McpInstallationEntity } from '../entities/mcp-installation.entity';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthAuthorizationCodeEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';
import { McpOAuthPublicUrls } from '../oauth/mcp-oauth.types';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthArtifactService } from './mcp-oauth-artifact.service';
import { McpOAuthPublicUrlService } from './mcp-oauth-public-url.service';

describe('McpOAuthArtifactService', () => {
	let dataSource: DataSource;
	let service: McpOAuthArtifactService;
	let urls: McpOAuthPublicUrls;
	let approver: UserEntity;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpInstallationEntity,
				McpOAuthAccessTokenEntity,
				McpOAuthAuthorizationCodeEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthInteractionEntity,
				McpOAuthRefreshTokenEntity,
				McpOAuthRefreshTokenFamilyEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		approver = await dataSource.getRepository(UserEntity).save(
			dataSource.getRepository(UserEntity).create({
				username: 'owner',
				password: null,
				email: null,
				firstName: null,
				lastName: null,
				role: UserRole.OWNER,
				language: UserLanguage.EN,
				isHidden: false,
			}),
		);
		urls = publicUrls('https://panel.example.com');
		const installationService = new McpInstallationService(dataSource.getRepository(McpInstallationEntity));
		const publicUrlService = { getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService;
		service = new McpOAuthArtifactService(
			dataSource.getRepository(McpOAuthClientEntity),
			dataSource.getRepository(McpOAuthGrantEntity),
			dataSource.getRepository(McpOAuthInteractionEntity),
			dataSource.getRepository(McpOAuthAuthorizationCodeEntity),
			dataSource.getRepository(McpOAuthAccessTokenEntity),
			dataSource.getRepository(McpOAuthRefreshTokenFamilyEntity),
			installationService,
			publicUrlService,
		);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('stores only hashes for interactions, codes, access tokens, and refresh tokens', async () => {
		const client = await createClient(service, approver.id);
		const grant = await service.createGrant({
			clientId: client.id,
			approvedById: approver.id,
			approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
		});
		const interaction = await service.createInteraction({
			clientId: client.id,
			redirectUri: 'http://127.0.0.1:49152/callback',
			requestedScopes: [McpOAuthScope.READ],
			expiresAt: new Date(Date.now() + 60_000),
		});
		const code = await service.issueAuthorizationCode({
			clientId: client.id,
			grant,
			interactionId: interaction.artifact.id,
			redirectUri: interaction.artifact.redirectUri,
			scopes: [McpOAuthScope.READ],
			codeChallenge: 's256-challenge',
			expiresAt: new Date(Date.now() + 60_000),
		});
		const family = await service.issueRefreshFamily({ clientId: client.id, grant });
		const access = await service.issueAccessToken({
			clientId: client.id,
			grant,
			scopes: [McpOAuthScope.READ],
			refreshFamilyId: family.family.id,
		});

		expect(interaction.artifact.uidHash).toBe(hashToken(interaction.rawValue));
		expect(code.artifact.codeHash).toBe(hashToken(code.rawValue));
		expect(access.artifact.tokenHash).toBe(hashToken(access.rawValue));
		expect(family.refreshToken.artifact.tokenHash).toBe(hashToken(family.refreshToken.rawValue));

		const persisted = JSON.stringify({
			interaction: await dataSource.getRepository(McpOAuthInteractionEntity).find(),
			codes: await dataSource.getRepository(McpOAuthAuthorizationCodeEntity).find(),
			access: await dataSource.getRepository(McpOAuthAccessTokenEntity).find(),
			refresh: await dataSource.getRepository(McpOAuthRefreshTokenEntity).find(),
		});

		for (const raw of [interaction.rawValue, code.rawValue, access.rawValue, family.refreshToken.rawValue]) {
			expect(persisted).not.toContain(raw);
		}
	});

	it('binds grants and tokens to the installation/public identity and caps access expiry at grant expiry', async () => {
		const client = await createClient(service, approver.id);
		const grantExpiry = new Date(Date.now() + 90_000);
		const firstGrant = await service.createGrant({
			clientId: client.id,
			approvedById: approver.id,
			approvedScopes: [McpOAuthScope.READ],
			expiresAt: grantExpiry,
		});
		const access = await service.issueAccessToken({
			clientId: client.id,
			grant: firstGrant,
			scopes: [McpOAuthScope.READ],
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		});

		expect(firstGrant.installationId).toMatch(/^[0-9a-f-]{36}$/);
		expect(firstGrant).toMatchObject({ issuer: urls.issuer, resource: urls.resource });
		expect(access.artifact).toMatchObject({
			installationId: firstGrant.installationId,
			issuer: urls.issuer,
			resource: urls.resource,
			expiresAt: grantExpiry,
		});

		urls = publicUrls('https://new-panel.example.com');
		const secondGrant = await service.createGrant({
			clientId: client.id,
			approvedById: approver.id,
			approvedScopes: [McpOAuthScope.READ],
		});

		expect(secondGrant.installationId).toBe(firstGrant.installationId);
		expect(secondGrant.resource).toBe('https://new-panel.example.com/api/v1/modules/mcp');
		expect(firstGrant.resource).toBe('https://panel.example.com/api/v1/modules/mcp');
	});

	function publicUrls(base: string): McpOAuthPublicUrls {
		const resource = `${base}/api/v1/modules/mcp`;
		const issuer = `${resource}/oauth`;

		return {
			publicBaseUrl: base,
			resource,
			protectedResourceMetadata: `${base}/.well-known/oauth-protected-resource/api/v1/modules/mcp`,
			issuer,
			authorizationServerMetadata: `${base}/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth`,
			authorizationEndpoint: `${issuer}/authorize`,
			tokenEndpoint: `${issuer}/token`,
			revocationEndpoint: `${issuer}/token/revocation`,
		};
	}

	async function createClient(artifactService: McpOAuthArtifactService, createdById: string) {
		return artifactService.createClient({
			name: 'Codex',
			redirectUris: ['http://127.0.0.1:49152/callback'],
			maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
			createdById,
		});
	}
});
