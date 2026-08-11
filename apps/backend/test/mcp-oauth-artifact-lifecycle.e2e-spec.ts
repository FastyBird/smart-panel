import { RequestListener } from 'node:http';
import type { Adapter } from 'oidc-provider';
import { DataSource } from 'typeorm';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { hashToken } from '../src/modules/auth/utils/token.utils';
import { ConfigService } from '../src/modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../src/modules/config/services/module-config-mutation-registry.service';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { UpdateMcpConfigDto } from '../src/modules/mcp/dto/update-config.dto';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
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
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import {
	MCP_CATALOG_REGISTRAR,
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
import { McpOAuthProxyPolicyService } from '../src/modules/mcp/services/mcp-oauth-proxy-policy.service';
import { McpOAuthPublicUrlService } from '../src/modules/mcp/services/mcp-oauth-public-url.service';
import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessService,
} from '../src/modules/mcp/services/mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../src/modules/mcp/services/mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from '../src/modules/mcp/services/mcp-oauth-switch-off.service';
import { McpPolicyRequest, McpPolicyService } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
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

interface ArtifactProvider {
	authorizationCodes: Adapter;
	accessTokens: Adapter;
	refreshTokens: Adapter;
}

interface WireSubscriptions {
	oauthClient: Client;
	oauthSubscription: Awaited<ReturnType<Client['listen']>>;
	staticClient: Client;
	staticSubscription: Awaited<ReturnType<Client['listen']>>;
	close: () => Promise<void>;
}

const getArtifactProvider = (provider: McpOAuthProviderRuntime['provider']): ArtifactProvider =>
	provider as unknown as ArtifactProvider;

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

		const auditService = new McpAuditService();
		const subscriptions = new McpSubscriptionRegistryService(auditService);
		let wireSubscriptions: WireSubscriptions | undefined;

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
			const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
				allowTestInMemory: true,
				artifactReuseError: () => new Error('The OAuth artifact is no longer active'),
			});
			const readiness = new McpOAuthReadinessService();
			readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
			readiness.onApplicationBootstrap();
			const routeGate = new McpOAuthRouteGateService(readiness);
			const createRuntime = jest.fn(() => {
				const callback: RequestListener = (_request, response) => response.end();
				const provider: ArtifactProvider = {
					authorizationCodes: new Adapter('AuthorizationCode'),
					accessTokens: new Adapter('AccessToken'),
					refreshTokens: new Adapter('RefreshToken'),
				};
				const runtime: McpOAuthProviderRuntime = {
					provider: provider as unknown as McpOAuthProviderRuntime['provider'],
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

			await lifecycle.onApplicationBootstrap();
			expect(routeGate.isOpen).toBe(true);
			expect(createRuntime).toHaveBeenCalledTimes(1);

			const initialProvider = getArtifactProvider(runtime.getActive().provider);
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

			await initialProvider.authorizationCodes.upsert(
				rawAuthorizationCode,
				{ ...basePayload, kind: 'AuthorizationCode' },
				60,
			);
			await initialProvider.refreshTokens.upsert(rawRefreshToken, { ...basePayload, kind: 'RefreshToken' }, 3_600);
			await initialProvider.accessTokens.upsert(
				rawAccessToken,
				{ ...basePayload, gty: 'refresh_token', kind: 'AccessToken' },
				600,
			);

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

			const authInfo = await resourceServer.verifyAccessToken(rawAccessToken);
			expect(authInfo).toMatchObject({
				clientId: client.clientIdentifier,
			});
			wireSubscriptions = await openWireSubscriptions(
				config,
				routeGate,
				resourceServer,
				subscriptions,
				auditService,
				rawAccessToken,
			);

			expect(subscriptions.activeCount).toBe(2);
			await expect(initialProvider.authorizationCodes.find(rawAuthorizationCode)).resolves.toBeDefined();
			await expect(initialProvider.accessTokens.find(rawAccessToken)).resolves.toBeDefined();
			await expect(initialProvider.refreshTokens.find(rawRefreshToken)).resolves.toBeDefined();

			await updateOAuth(false);

			expect(config.oauthEnabled).toBe(false);
			expect(routeGate.isOpen).toBe(false);
			expect(() => routeGate.assertOpen()).toThrow('The MCP OAuth route gate is closed');
			expect(() => runtime.getActive()).toThrow('The MCP OAuth route gate is closed');
			await expect(wireSubscriptions.oauthSubscription.closed).resolves.toBe('remote');
			await expect(wireSubscriptions.oauthClient.listTools()).rejects.toThrow();
			await expect(wireSubscriptions.staticClient.listTools()).resolves.toMatchObject({ tools: [] });
			await expectSubscriptionOpen(wireSubscriptions.staticSubscription.closed);
			expect(subscriptions.activeCount).toBe(1);
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
			await expect(wireSubscriptions.oauthClient.listTools()).rejects.toThrow();
			await expect(wireSubscriptions.staticClient.listTools()).resolves.toMatchObject({ tools: [] });
			await expectSubscriptionOpen(wireSubscriptions.staticSubscription.closed);
			expect(subscriptions.activeCount).toBe(1);
			const replacementProvider = getArtifactProvider(runtime.getActive().provider);

			expect(replacementProvider).not.toBe(initialProvider);
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
			await expect(replacementProvider.authorizationCodes.find(rawAuthorizationCode)).resolves.toBeUndefined();
			await expect(replacementProvider.accessTokens.find(rawAccessToken)).resolves.toBeUndefined();
			await expect(replacementProvider.refreshTokens.find(rawRefreshToken)).resolves.toBeUndefined();
		} finally {
			await wireSubscriptions?.close();
			await subscriptions.closeAll();
			await dataSource.destroy();
		}
	});
});

async function openWireSubscriptions(
	config: McpConfigModel,
	routeGate: McpOAuthRouteGateService,
	resourceServer: McpOAuthResourceServerService,
	subscriptions: McpSubscriptionRegistryService,
	auditService: McpAuditService,
	oauthAccessToken: string,
): Promise<WireSubscriptions> {
	const staticClientId = 'static-lifecycle-client';
	const staticToken = 'static-lifecycle-token';
	const moduleRef = await Test.createTestingModule({
		controllers: [McpController],
		providers: [
			{ provide: McpAuditService, useValue: auditService },
			{ provide: McpOAuthProxyPolicyService, useValue: { assertForwardedHeadersTrusted: jest.fn() } },
			{ provide: McpOAuthResourceServerService, useValue: resourceServer },
			{ provide: McpOAuthRouteGateService, useValue: routeGate },
			{ provide: McpPolicyService, useValue: { validateOAuthRequestOrigin: jest.fn() } },
			McpServerService,
			{ provide: McpSubscriptionRegistryService, useValue: subscriptions },
			{ provide: MCP_CATALOG_REGISTRAR, useValue: { register: () => undefined } },
		],
	})
		.overrideGuard(McpClientGuard)
		.useValue({
			canActivate: (context: { switchToHttp: () => { getRequest: () => McpPolicyRequest } }): boolean => {
				const request = context.switchToHttp().getRequest();

				if (request.headers.authorization !== `Bearer ${staticToken}`) return true;

				request.mcpPolicy = {
					client: {
						id: staticClientId,
						name: 'Static lifecycle client',
						enabled: true,
						capabilities: [McpCapability.READ],
						tokenId: staticToken,
						token: { id: staticToken, revoked: false, expiresAt: new Date(Date.now() + 60_000) },
					} as McpClientEntity,
					config,
					clientPolicyRevision: 0,
					effectiveCapabilities: [McpCapability.READ],
					installationId: 'artifact-lifecycle-installation',
					policyRevision: 0,
					tokenId: staticToken,
				};

				return true;
			},
		})
		.compile();
	const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

	await app.listen(0, '127.0.0.1');
	const endpoint = new URL('/', await app.getUrl());
	const staticClient = new Client(
		{ name: 'static-lifecycle-e2e', version: '1.0.0' },
		{ versionNegotiation: { mode: 'auto' } },
	);
	const oauthClient = new Client(
		{ name: 'oauth-lifecycle-e2e', version: '1.0.0' },
		{ versionNegotiation: { mode: 'auto' } },
	);
	const staticTransport = new StreamableHTTPClientTransport(endpoint, {
		requestInit: { headers: { Authorization: `Bearer ${staticToken}` } },
	});
	const oauthTransport = new StreamableHTTPClientTransport(endpoint, {
		requestInit: { headers: { Authorization: `Bearer ${oauthAccessToken}` } },
	});

	try {
		await staticClient.connect(staticTransport);
		await oauthClient.connect(oauthTransport);
		const staticSubscription = await staticClient.listen({ toolsListChanged: true });
		const oauthSubscription = await oauthClient.listen({ toolsListChanged: true });

		return {
			oauthClient,
			oauthSubscription,
			staticClient,
			staticSubscription,
			close: async () => {
				await Promise.allSettled([oauthClient.close(), staticClient.close()]);
				await app.get(McpServerService).closeAll();
				await app.close();
			},
		};
	} catch (error) {
		await Promise.allSettled([oauthClient.close(), staticClient.close()]);
		await app.close();
		throw error;
	}
}

async function expectSubscriptionOpen(closed: Promise<unknown>): Promise<void> {
	const closedEarly = await Promise.race([
		closed.then(() => true),
		new Promise<boolean>((resolve) => {
			setTimeout(() => resolve(false), 50);
		}),
	]);

	expect(closedEarly).toBe(false);
}
