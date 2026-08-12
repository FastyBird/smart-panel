import type { FastifyReply } from 'fastify';
import { DataSource } from 'typeorm';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { AuthInfo } from '@modelcontextprotocol/server';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { hashToken } from '../src/modules/auth/utils/token.utils';
import { ConfigService } from '../src/modules/config/services/config.service';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
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
	MCP_OAUTH_SERVER_STATE_KEY,
	McpCapability,
	McpOAuthScope,
} from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { createMcpOAuthProviderAdapter } from '../src/modules/mcp/oauth/mcp-oauth-provider.adapter';
import { McpOAuthPublicUrls } from '../src/modules/mcp/oauth/mcp-oauth.types';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpInstallationService } from '../src/modules/mcp/services/mcp-installation.service';
import { McpOAuthClientService } from '../src/modules/mcp/services/mcp-oauth-client.service';
import { McpOAuthGlobalInvalidationService } from '../src/modules/mcp/services/mcp-oauth-global-invalidation.service';
import { McpOAuthManagementService } from '../src/modules/mcp/services/mcp-oauth-management.service';
import { McpOAuthProxyPolicyService } from '../src/modules/mcp/services/mcp-oauth-proxy-policy.service';
import { McpOAuthPublicUrlService } from '../src/modules/mcp/services/mcp-oauth-public-url.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
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

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
	let resolve = (): void => undefined;
	const promise = new Promise<void>((resolver) => {
		resolve = resolver;
	});

	return { promise, resolve };
};

describe('MCP OAuth listen registration race', () => {
	it('expires live subscriptions and closes matching streams during revocation', async () => {
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
		const auditLogger = (auditService as unknown as { logger: { log: (...args: unknown[]) => void } }).logger;
		const auditLog = jest.spyOn(auditLogger, 'log').mockImplementation(() => undefined);
		const subscriptions = new McpSubscriptionRegistryService(auditService);
		let app: NestFastifyApplication | undefined;
		let client: Client | undefined;
		let expiryClient: Client | undefined;
		let grantExpiryClient: Client | undefined;
		let grantRevocationClient: Client | undefined;
		const releaseListen = deferred();

		try {
			const user = await dataSource.getRepository(UserEntity).save({
				id: 'listen-race-owner',
				username: 'owner',
				password: null,
				email: null,
				firstName: null,
				lastName: null,
				role: UserRole.OWNER,
				language: UserLanguage.EN,
				isHidden: false,
			});
			const oauthClient = await dataSource.getRepository(McpOAuthClientEntity).save({
				clientIdentifier: 'listen-registration-race-client',
				name: 'Listen registration race client',
				redirectUris: ['http://127.0.0.1:1455/callback'],
				maximumScopes: [McpOAuthScope.READ],
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
			const rawGrantId = 'listen-registration-race-grant';
			const grant = await dataSource.getRepository(McpOAuthGrantEntity).save({
				providerGrantIdHash: hashToken(rawGrantId),
				clientId: oauthClient.id,
				approvedById: user.id,
				installationId: 'listen-registration-race-installation',
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [McpOAuthScope.READ],
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
			const rawExpiringGrantId = 'listen-expiring-grant';
			const expiringGrant = await dataSource.getRepository(McpOAuthGrantEntity).save({
				providerGrantIdHash: hashToken(rawExpiringGrantId),
				clientId: oauthClient.id,
				approvedById: user.id,
				installationId: 'listen-registration-race-installation',
				issuer: urls.issuer,
				resource: urls.resource,
				approvedScopes: [McpOAuthScope.READ],
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
			};
			const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
				allowTestInMemory: true,
				artifactReuseError: () => new Error('The OAuth artifact is no longer active'),
			});
			const rawAccessToken = 'listen-registration-race-access-token';

			const accessTokens = new Adapter('AccessToken');

			await accessTokens.upsert(
				rawAccessToken,
				{
					accountId: user.id,
					aud: urls.resource,
					clientId: oauthClient.clientIdentifier,
					grantId: rawGrantId,
					kind: 'AccessToken',
					scope: McpOAuthScope.READ,
				},
				600,
			);
			const accessArtifact = await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
				model: 'AccessToken',
				idHash: hashToken(rawAccessToken),
			});
			const resourceServer = new McpOAuthResourceServerService(
				dataSource.getRepository(McpOAuthProviderArtifactEntity),
				dataSource.getRepository(McpOAuthProviderRevokedGrantEntity),
				dataSource.getRepository(McpOAuthGrantEntity),
				dataSource.getRepository(McpOAuthApproverAuthorityEntity),
				dataSource.getRepository(McpOAuthServerStateEntity),
				configService as unknown as ConfigService,
				{
					getInstallationId: jest.fn(() => Promise.resolve('listen-registration-race-installation')),
				} as unknown as McpInstallationService,
				{ getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService,
			);
			const management = new McpOAuthManagementService(
				dataSource.getRepository(McpOAuthGrantEntity),
				dataSource.getRepository(McpOAuthProviderArtifactEntity),
				dataSource,
				configService as unknown as ConfigService,
				{} as McpOAuthClientService,
				subscriptions,
				{} as McpOAuthGlobalInvalidationService,
				auditService,
			);
			const routeGate = {
				isOpen: true,
				assertOpen: jest.fn(),
			};
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
				.useValue({ canActivate: () => true })
				.compile();

			app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
			await app.listen(0, '127.0.0.1');
			const serverService = app.get<McpServerService>(McpServerService);
			const listenAuthenticated = deferred();
			const endpoint = new URL('/', await app.getUrl());
			const shortLivedAccessToken = 'listen-expiry-access-token';

			await accessTokens.upsert(
				shortLivedAccessToken,
				{
					accountId: user.id,
					aud: urls.resource,
					clientId: oauthClient.clientIdentifier,
					grantId: rawGrantId,
					kind: 'AccessToken',
					scope: McpOAuthScope.READ,
				},
				60,
			);
			expiryClient = new Client(
				{ name: 'listen-expiry-e2e', version: '1.0.0' },
				{ versionNegotiation: { mode: 'auto' } },
			);
			const expiryTransport = new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${shortLivedAccessToken}` } },
			});

			await expiryClient.connect(expiryTransport);
			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.update({ model: 'AccessToken', idHash: hashToken(shortLivedAccessToken) }, { expiresAt: Date.now() + 5_000 });
			const expiringSubscription = await expiryClient.listen({ toolsListChanged: true });

			await expect(expiringSubscription.closed).resolves.toBe('remote');
			expect(subscriptions.activeCount).toBe(0);
			expect(auditLog).toHaveBeenCalledWith(
				'MCP audit event',
				expect.objectContaining({ event: 'subscription_close', reason: 'authorization_expired' }),
			);
			await expiryClient.close();
			expiryClient = undefined;

			const grantExpiryAccessToken = 'listen-grant-expiry-access-token';

			await accessTokens.upsert(
				grantExpiryAccessToken,
				{
					accountId: user.id,
					aud: urls.resource,
					clientId: oauthClient.clientIdentifier,
					grantId: rawExpiringGrantId,
					kind: 'AccessToken',
					scope: McpOAuthScope.READ,
				},
				60,
			);
			grantExpiryClient = new Client(
				{ name: 'listen-grant-expiry-e2e', version: '1.0.0' },
				{ versionNegotiation: { mode: 'auto' } },
			);
			const grantExpiryTransport = new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${grantExpiryAccessToken}` } },
			});

			await grantExpiryClient.connect(grantExpiryTransport);
			await dataSource
				.getRepository(McpOAuthGrantEntity)
				.update({ id: expiringGrant.id }, { expiresAt: new Date(Date.now() + 5_000) });
			const grantExpiringSubscription = await grantExpiryClient.listen({ toolsListChanged: true });

			await expect(grantExpiringSubscription.closed).resolves.toBe('remote');
			expect(subscriptions.activeCount).toBe(0);
			expect(
				auditLog.mock.calls.filter(
					([message, event]) =>
						message === 'MCP audit event' &&
						(event as { event?: string; reason?: string }).event === 'subscription_close' &&
						(event as { event?: string; reason?: string }).reason === 'authorization_expired',
				),
			).toHaveLength(2);
			await grantExpiryClient.close();
			grantExpiryClient = undefined;

			jest
				.spyOn(serverService, 'handleOAuth')
				.mockImplementation(
					async (request: McpPolicyRequest, reply: FastifyReply, authInfo: AuthInfo): Promise<void> => {
						if ((request.body as { method?: string } | undefined)?.method === 'subscriptions/listen') {
							listenAuthenticated.resolve();
							await releaseListen.promise;
						}

						await McpServerService.prototype.handleOAuth.call(serverService, request, reply, authInfo);
					},
				);

			client = new Client(
				{ name: 'listen-registration-race-e2e', version: '1.0.0' },
				{ versionNegotiation: { mode: 'auto' } },
			);
			const transport = new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${rawAccessToken}` } },
			});

			await client.connect(transport);
			const rejectedListen = expect(client.listen({ toolsListChanged: true })).rejects.toThrow();

			await listenAuthenticated.promise;
			await management.revokeAccessToken(accessArtifact.managementId, 'owner-actor');

			expect(subscriptions.activeCount).toBe(0);
			expect(auditLog).toHaveBeenCalledWith('MCP audit event', {
				event: 'oauth_management',
				request_id: 'administrative',
				actor_id: 'owner-actor',
				artifact: 'access_token',
				artifact_id: accessArtifact.managementId,
				action: 'revoked',
			});
			expect(JSON.stringify(auditLog.mock.calls)).not.toContain(rawAccessToken);
			await expect(resourceServer.verifyAccessToken(rawAccessToken)).rejects.toThrow(
				'The MCP OAuth access token is invalid or no longer active',
			);

			releaseListen.resolve();
			await rejectedListen;
			expect(subscriptions.activeCount).toBe(0);
			expect(
				await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneBy({
					model: 'AccessToken',
					idHash: hashToken(rawAccessToken),
				}),
			).toBeNull();
			expect(
				(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).revokedAt,
			).toBeNull();

			const grantRevocationAccessToken = 'listen-grant-revocation-access-token';

			await accessTokens.upsert(
				grantRevocationAccessToken,
				{
					accountId: user.id,
					aud: urls.resource,
					clientId: oauthClient.clientIdentifier,
					grantId: rawGrantId,
					kind: 'AccessToken',
					scope: McpOAuthScope.READ,
				},
				600,
			);
			grantRevocationClient = new Client(
				{ name: 'listen-grant-revocation-e2e', version: '1.0.0' },
				{ versionNegotiation: { mode: 'auto' } },
			);
			const grantRevocationTransport = new StreamableHTTPClientTransport(endpoint, {
				requestInit: { headers: { Authorization: `Bearer ${grantRevocationAccessToken}` } },
			});

			await grantRevocationClient.connect(grantRevocationTransport);
			const grantRevokedSubscription = await grantRevocationClient.listen({ toolsListChanged: true });

			expect(subscriptions.activeCount).toBe(1);
			await management.revokeGrant(grant.id, 'owner-actor');
			await expect(grantRevokedSubscription.closed).resolves.toBe('remote');
			expect(subscriptions.activeCount).toBe(0);
			expect(auditLog).toHaveBeenCalledWith(
				'MCP audit event',
				expect.objectContaining({ event: 'subscription_close', reason: 'authorization_revoked' }),
			);
			expect(auditLog).toHaveBeenCalledWith('MCP audit event', {
				event: 'oauth_management',
				request_id: 'administrative',
				actor_id: 'owner-actor',
				artifact: 'grant',
				artifact_id: grant.id,
				action: 'revoked',
			});
			await expect(resourceServer.verifyAccessToken(grantRevocationAccessToken)).rejects.toThrow(
				'The MCP OAuth access token is invalid or no longer active',
			);
			expect(
				await dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneBy({
					model: 'AccessToken',
					idHash: hashToken(grantRevocationAccessToken),
				}),
			).toBeNull();
			await grantRevocationClient.close();
			grantRevocationClient = undefined;
		} finally {
			releaseListen.resolve();
			await expiryClient?.close();
			await grantExpiryClient?.close();
			await grantRevocationClient?.close();
			await client?.close();
			if (app) {
				await app.get(McpServerService).closeAll();
				await app.close();
			}
			await subscriptions.closeAll();
			await dataSource.destroy();
		}
	}, 90_000);
});
