import { RequestListener } from 'node:http';
import { DataSource } from 'typeorm';

import { hashToken } from '../src/modules/auth/utils/token.utils';
import { ConfigService } from '../src/modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../src/modules/config/services/module-config-mutation-registry.service';
import { UpdateMcpConfigDto } from '../src/modules/mcp/dto/update-config.dto';
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
} from '../src/modules/mcp/entities/mcp-oauth.entity';
import {
	MCP_MODULE_NAME,
	MCP_OAUTH_SERVER_STATE_KEY,
	McpCapability,
	McpOAuthScope,
} from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { createMcpOAuthProviderAdapter } from '../src/modules/mcp/oauth/mcp-oauth-provider.adapter';
import { McpOAuthProviderFactory, McpOAuthProviderRuntime } from '../src/modules/mcp/oauth/mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from '../src/modules/mcp/oauth/mcp-oauth.types';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpInstallationService } from '../src/modules/mcp/services/mcp-installation.service';
import { McpOAuthClientService } from '../src/modules/mcp/services/mcp-oauth-client.service';
import { McpOAuthGlobalInvalidationService } from '../src/modules/mcp/services/mcp-oauth-global-invalidation.service';
import { McpOAuthLifecycleService } from '../src/modules/mcp/services/mcp-oauth-lifecycle.service';
import { McpOAuthModuleConfigMutationService } from '../src/modules/mcp/services/mcp-oauth-module-config-mutation.service';
import { McpOAuthPublicUrlService } from '../src/modules/mcp/services/mcp-oauth-public-url.service';
import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessService,
} from '../src/modules/mcp/services/mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../src/modules/mcp/services/mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from '../src/modules/mcp/services/mcp-oauth-switch-off.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { UserEntity } from '../src/modules/users/entities/users.entity';
import { UserLanguage, UserRole } from '../src/modules/users/users.constants';

const urls: McpOAuthPublicUrls = {
	publicBaseUrl: 'https://panel.example.com',
	resource: 'https://panel.example.com/api/v1/modules/mcp',
	protectedResourceMetadata: 'https://panel.example.com/.well-known/oauth-protected-resource/api/v1/modules/mcp',
	issuer: 'https://panel.example.com/api/v1/modules/mcp/oauth',
	authorizationServerMetadata:
		'https://panel.example.com/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth',
	authorizationEndpoint: 'https://panel.example.com/api/v1/modules/mcp/oauth/authorize',
	tokenEndpoint: 'https://panel.example.com/api/v1/modules/mcp/oauth/token',
	revocationEndpoint: 'https://panel.example.com/api/v1/modules/mcp/oauth/token/revocation',
};

describe('MCP OAuth artifact lifecycle', () => {
	it('never reactivates artifacts issued before readiness-gated switch-off and re-enable', async () => {
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

		const auditService = {
			recordOAuthAuthorizationInvalidation: jest.fn(),
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		const subscriptions = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);

		try {
			const user = await dataSource.getRepository(UserEntity).save({
				id: 'owner-one',
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
				clientIdentifier: 'artifact-lifecycle-client',
				name: 'Artifact lifecycle client',
				redirectUris: ['http://127.0.0.1:1455/callback'],
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
			const rawGrantId = 'provider-grant-before-switch-off';
			const grant = await dataSource.getRepository(McpOAuthGrantEntity).save({
				providerGrantIdHash: hashToken(rawGrantId),
				clientId: client.id,
				approvedById: user.id,
				installationId: 'artifact-lifecycle-installation',
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
				oauthEnabledGeneration: 0,
				serverSecretVersion: 1,
				publicIdentityGeneration: 0,
				clientGeneration: 0,
				modulePolicyGeneration: 0,
			});
			const config = Object.assign(new McpConfigModel(), {
				enabled: true,
				oauthEnabled: true,
				oauthPublicBaseUrl: urls.publicBaseUrl,
				capabilities: [McpCapability.READ],
			});
			const configService = {
				getModuleConfig: jest.fn(() => config),
				reload: jest.fn(),
			};
			const readiness = new McpOAuthReadinessService();
			readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
			readiness.onApplicationBootstrap();
			const routeGate = new McpOAuthRouteGateService(readiness);
			const createRuntime = jest.fn(() => {
				const callback: RequestListener = (_request, response) => response.end();
				const runtime: McpOAuthProviderRuntime = {
					provider: {} as McpOAuthProviderRuntime['provider'],
					callback,
					urls,
					metadata: { issuer: urls.issuer } as McpOAuthProviderRuntime['metadata'],
				};

				return Promise.resolve(runtime);
			});
			const runtime = new McpOAuthRuntimeService(
				{ create: createRuntime } as unknown as McpOAuthProviderFactory,
				routeGate,
			);
			const lifecycle = new McpOAuthLifecycleService(
				configService as unknown as ConfigService,
				readiness,
				routeGate,
				runtime,
			);
			const globalInvalidation = new McpOAuthGlobalInvalidationService(dataSource, subscriptions);
			const switchOff = new McpOAuthSwitchOffService(
				routeGate,
				runtime,
				globalInvalidation,
				auditService as unknown as McpAuditService,
			);
			const moduleConfigMutation = new McpOAuthModuleConfigMutationService(
				configService as unknown as ConfigService,
				dataSource.getRepository(McpOAuthServerStateEntity),
				subscriptions,
				globalInvalidation,
				auditService as unknown as McpAuditService,
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

			await lifecycle.onApplicationBootstrap();
			expect(routeGate.isOpen).toBe(true);
			expect(createRuntime).toHaveBeenCalledTimes(1);

			const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
				allowTestInMemory: true,
				artifactReuseError: () => new Error('The OAuth artifact is no longer active'),
			});
			const authorizationCodes = new Adapter('AuthorizationCode');
			const accessTokens = new Adapter('AccessToken');
			const refreshTokens = new Adapter('RefreshToken');
			const rawAuthorizationCode = 'authorization-code-before-switch-off';
			const rawAccessToken = 'access-token-before-switch-off';
			const rawRefreshToken = 'refresh-token-before-switch-off';
			const basePayload = {
				accountId: user.id,
				aud: urls.resource,
				clientId: client.clientIdentifier,
				grantId: rawGrantId,
				scope: `${McpOAuthScope.READ} ${McpOAuthScope.OFFLINE_ACCESS}`,
			};

			await authorizationCodes.upsert(rawAuthorizationCode, { ...basePayload, kind: 'AuthorizationCode' }, 60);
			await refreshTokens.upsert(rawRefreshToken, { ...basePayload, kind: 'RefreshToken' }, 3_600);
			await accessTokens.upsert(rawAccessToken, { ...basePayload, gty: 'refresh_token', kind: 'AccessToken' }, 600);

			const resourceServer = new McpOAuthResourceServerService(
				dataSource.getRepository(McpOAuthProviderArtifactEntity),
				dataSource.getRepository(McpOAuthProviderRevokedGrantEntity),
				dataSource.getRepository(McpOAuthGrantEntity),
				dataSource.getRepository(McpOAuthApproverAuthorityEntity),
				dataSource.getRepository(McpOAuthServerStateEntity),
				configService as unknown as ConfigService,
				{
					getInstallationId: jest.fn(() => Promise.resolve('artifact-lifecycle-installation')),
				} as unknown as McpInstallationService,
				{ getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService,
			);

			await expect(resourceServer.verifyAccessToken(rawAccessToken)).resolves.toMatchObject({
				clientId: client.clientIdentifier,
			});
			await expect(authorizationCodes.find(rawAuthorizationCode)).resolves.toBeDefined();
			await expect(refreshTokens.find(rawRefreshToken)).resolves.toBeDefined();

			await updateOAuth(false);

			expect(config.oauthEnabled).toBe(false);
			expect(routeGate.isOpen).toBe(false);
			expect(() => runtime.getActive()).toThrow('The MCP OAuth route gate is closed');
			expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
			expect(
				await dataSource
					.getRepository(McpOAuthProviderRevokedGrantEntity)
					.existsBy({ grantIdHash: hashToken(rawGrantId) }),
			).toBe(true);

			await updateOAuth(true);

			expect(config.oauthEnabled).toBe(true);
			expect(routeGate.isOpen).toBe(true);
			expect(createRuntime).toHaveBeenCalledTimes(2);
			expect(
				(
					await dataSource.getRepository(McpOAuthServerStateEntity).findOneByOrFail({
						key: MCP_OAUTH_SERVER_STATE_KEY,
					})
				).oauthEnabledGeneration,
			).toBe(2);
			expect(
				(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).revokedAt,
			).not.toBeNull();
			await expect(resourceServer.verifyAccessToken(rawAccessToken)).rejects.toThrow(
				'The MCP OAuth access token is invalid or no longer active',
			);
			await expect(authorizationCodes.find(rawAuthorizationCode)).resolves.toBeUndefined();
			await expect(refreshTokens.find(rawRefreshToken)).resolves.toBeUndefined();
		} finally {
			await subscriptions.closeAll();
			await dataSource.destroy();
		}
	});
});
