import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { hashToken } from '../../auth/utils/token.utils';
import { ConfigService } from '../../config/services/config.service';
import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
import {
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';
import { McpOAuthClientModel } from '../models/mcp-oauth-client.model';
import { createMcpOAuthProviderAdapter } from '../oauth/mcp-oauth-provider.adapter';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthClientService } from './mcp-oauth-client.service';
import { McpOAuthManagementService } from './mcp-oauth-management.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpOAuthManagementService', () => {
	let dataSource: DataSource;
	let service: McpOAuthManagementService;
	let subscriptions: McpSubscriptionRegistryService;
	let client: McpOAuthClientEntity;
	let otherClient: McpOAuthClientEntity;
	let grant: McpOAuthGrantEntity;
	let otherGrant: McpOAuthGrantEntity;
	let accessId: string;
	let familyId: string;
	let moduleEnabled: boolean;
	let auditService: {
		recordOAuthManagementAction: jest.Mock;
		recordSubscriptionClosed: jest.Mock;
		recordSubscriptionOpened: jest.Mock;
	};

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthProviderArtifactEntity,
				McpOAuthProviderRevokedGrantEntity,
				McpOAuthProviderRevokedRefreshFamilyEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		auditService = {
			recordOAuthManagementAction: jest.fn(),
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		subscriptions = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);
		moduleEnabled = true;
		const user = await dataSource.getRepository(UserEntity).save(
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
		const clients = dataSource.getRepository(McpOAuthClientEntity);
		client = await clients.save(
			clients.create({
				clientIdentifier: uuid(),
				name: 'Codex',
				redirectUris: ['http://127.0.0.1:1455/callback'],
				maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				enabled: true,
				generation: 0,
				createdById: user.id,
			}),
		);
		otherClient = await clients.save(
			clients.create({
				clientIdentifier: uuid(),
				name: 'Claude',
				redirectUris: ['http://127.0.0.1:49152/callback'],
				maximumScopes: [McpOAuthScope.READ],
				enabled: true,
				generation: 0,
				createdById: user.id,
			}),
		);
		const grants = dataSource.getRepository(McpOAuthGrantEntity);
		grant = await grants.save(
			grants.create({
				providerGrantIdHash: hashToken('grant-one'),
				clientId: client.id,
				approvedById: user.id,
				installationId: uuid(),
				issuer: 'https://panel.example.com/api/v1/modules/mcp/oauth',
				resource: 'https://panel.example.com/api/v1/modules/mcp',
				approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				expiresAt: new Date(Date.now() + 60_000),
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
			}),
		);
		otherGrant = await grants.save(
			grants.create({
				providerGrantIdHash: hashToken('grant-two'),
				clientId: otherClient.id,
				approvedById: user.id,
				installationId: grant.installationId,
				issuer: grant.issuer,
				resource: grant.resource,
				approvedScopes: [McpOAuthScope.READ],
				expiresAt: new Date(Date.now() + 60_000),
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
			}),
		);
		accessId = uuid();
		familyId = uuid();
		const artifacts = dataSource.getRepository(McpOAuthProviderArtifactEntity);
		await artifacts.save([
			artifacts.create({
				model: 'AccessToken',
				idHash: hashToken('access-one'),
				managementId: accessId,
				payload: JSON.stringify({ scope: 'mcp:read', clientId: client.clientIdentifier }),
				grantIdHash: grant.providerGrantIdHash,
				refreshFamilyId: familyId,
				userCodeHash: null,
				uidHash: null,
				consumedAt: null,
				expiresAt: Date.now() + 30_000,
			}),
			artifacts.create({
				model: 'RefreshToken',
				idHash: hashToken('refresh-one'),
				managementId: uuid(),
				payload: JSON.stringify({ scope: 'mcp:read offline_access' }),
				grantIdHash: grant.providerGrantIdHash,
				refreshFamilyId: familyId,
				userCodeHash: null,
				uidHash: null,
				consumedAt: null,
				expiresAt: Date.now() + 45_000,
			}),
			artifacts.create({
				model: 'AccessToken',
				idHash: hashToken('access-two'),
				managementId: uuid(),
				payload: JSON.stringify({ scope: 'mcp:read', clientId: otherClient.clientIdentifier }),
				grantIdHash: otherGrant.providerGrantIdHash,
				refreshFamilyId: null,
				userCodeHash: null,
				uidHash: null,
				consumedAt: null,
				expiresAt: Date.now() + 30_000,
			}),
		]);
		const clientsService = {
			getOneOrThrow: jest.fn(async (id: string) => clients.findOneByOrFail({ id })),
			assertScopesAllowed: jest.fn(),
			update: jest.fn(async (id: string, dto: Partial<McpOAuthClientEntity>) => {
				await clients.update({ id }, dto);

				return McpOAuthClientModel.fromEntity(await clients.findOneByOrFail({ id }));
			}),
		};
		service = new McpOAuthManagementService(
			grants,
			artifacts,
			dataSource,
			{ getModuleConfig: jest.fn(() => ({ enabled: moduleEnabled })) } as unknown as ConfigService,
			clientsService as unknown as McpOAuthClientService,
			subscriptions,
			auditService as unknown as McpAuditService,
		);
	});

	afterEach(async () => {
		await subscriptions.closeAll();
		await dataSource.destroy();
	});

	it('lists safe grant, access-token, and refresh-family management views', async () => {
		const grants = await service.findGrants();
		const accessTokens = await service.findAccessTokens();
		const families = await service.findRefreshFamilies();
		const serialized = JSON.stringify({ grants, accessTokens, families });

		expect(grants).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: grant.id, clientName: 'Codex', active: true })]),
		);
		expect(accessTokens).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: accessId, grantId: grant.id, scopes: [McpOAuthScope.READ] }),
			]),
		);
		expect(families).toEqual([expect.objectContaining({ id: familyId, grantId: grant.id, activeTokenCount: 1 })]);
		expect(serialized).not.toContain(hashToken('access-one'));
		expect(serialized).not.toContain(hashToken('grant-one'));
		expect(serialized).not.toContain('access-one');
	});

	it('excludes artifacts whose linked grant has expired', async () => {
		await dataSource
			.getRepository(McpOAuthGrantEntity)
			.update({ id: grant.id }, { expiresAt: new Date(Date.now() - 1_000) });

		expect(await service.findAccessTokens()).toEqual([expect.objectContaining({ clientId: otherClient.id })]);
		expect(await service.findRefreshFamilies()).toEqual([]);
		await expect(service.getAccessToken(accessId)).rejects.toThrow('not linked to an active grant');
		await expect(service.getRefreshFamily(familyId)).rejects.toThrow('does not exist');
	});

	it('excludes artifacts whose client or approver makes the grant inactive', async () => {
		await dataSource.getRepository(McpOAuthClientEntity).update({ id: client.id }, { enabled: false });

		expect(await service.findAccessTokens()).toEqual([expect.objectContaining({ clientId: otherClient.id })]);
		expect(await service.findRefreshFamilies()).toEqual([]);
		await expect(service.getAccessToken(accessId)).rejects.toThrow('not linked to an active grant');

		await dataSource.getRepository(McpOAuthClientEntity).update({ id: client.id }, { enabled: true });
		await dataSource.getRepository(UserEntity).update({ id: grant.approvedById }, { role: UserRole.USER });

		expect(await service.findAccessTokens()).toEqual([]);
		expect(await service.findRefreshFamilies()).toEqual([]);
	});

	it('marks grants inactive and hides their artifacts while the MCP module is disabled', async () => {
		moduleEnabled = false;

		expect(await service.getGrant(grant.id)).toMatchObject({ active: false });
		expect(await service.findAccessTokens()).toEqual([]);
		expect(await service.findRefreshFamilies()).toEqual([]);
	});

	it('treats a provider-revoked grant as revoked across management views', async () => {
		const providerRevokedAt = Date.now();
		await dataSource.getRepository(McpOAuthProviderRevokedGrantEntity).save({
			grantIdHash: grant.providerGrantIdHash,
			revokedAt: providerRevokedAt,
		});

		expect(await service.getGrant(grant.id)).toMatchObject({
			id: grant.id,
			active: false,
			revokedAt: new Date(providerRevokedAt),
		});
		expect((await service.findGrants()).find((item) => item.id === grant.id)).toMatchObject({ active: false });
		expect(await service.findAccessTokens()).toEqual([expect.objectContaining({ clientId: otherClient.id })]);
		expect(await service.findRefreshFamilies()).toEqual([]);
	});

	it('revokes one access token and closes only its matching subscription', async () => {
		const matching = await openSubscription(client.id, grant.id, accessId, familyId);
		const otherAccessId = (await service.findAccessTokens()).find((token) => token.clientId === otherClient.id)?.id;
		expect(otherAccessId).toBeDefined();
		const other = await openSubscription(otherClient.id, otherGrant.id, otherAccessId);

		await service.revokeAccessToken(accessId, 'actor-id');

		expect(matching.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		await expect(service.getAccessToken(accessId)).rejects.toThrow('does not exist');
		expect(auditService.recordOAuthManagementAction).toHaveBeenCalledWith(
			'actor-id',
			'access_token',
			accessId,
			'revoked',
		);
	});

	it('revokes a refresh family, its access tokens, and matching subscriptions', async () => {
		const matching = await openSubscription(client.id, grant.id, accessId, familyId);

		await service.revokeRefreshFamily(familyId, 'actor-id');

		expect(matching.signal.aborted).toBe(true);
		await expect(service.getRefreshFamily(familyId)).rejects.toThrow('does not exist');
		await expect(service.getAccessToken(accessId)).rejects.toThrow('does not exist');
	});

	it('prevents a paused refresh rotation from recreating a revoked family', async () => {
		let releaseUpsert = (): void => undefined;
		let signalUpsertReached = (): void => undefined;
		const upsertReached = new Promise<void>((resolve) => {
			signalUpsertReached = resolve;
		});
		const allowUpsert = new Promise<void>((resolve) => {
			releaseUpsert = resolve;
		});
		const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
			allowTestInMemory: true,
			beforeArtifactUpsert: async ({ model, refreshFamilyId }) => {
				if (model !== 'RefreshToken' || refreshFamilyId !== familyId) return;
				signalUpsertReached();
				await allowUpsert;
			},
		});
		const refreshAdapter = new Adapter('RefreshToken');
		const rotation = refreshAdapter.upsert(
			'rotating-refresh-token',
			{ grantId: 'grant-one', clientId: client.clientIdentifier, scope: 'mcp:read offline_access' },
			60,
		);

		await upsertReached;
		await service.revokeRefreshFamily(familyId, 'actor-id');
		releaseUpsert();

		await expect(rotation).rejects.toThrow('already consumed');
		expect(
			await dataSource
				.getRepository(McpOAuthProviderRevokedRefreshFamilyEntity)
				.existsBy({ refreshFamilyId: familyId }),
		).toBe(true);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).countBy({ refreshFamilyId: familyId })).toBe(
			0,
		);
	});

	it('revokes a grant and closes only subscriptions bound to that grant', async () => {
		const matching = await openSubscription(client.id, grant.id, accessId, familyId);
		const otherAccessId = (await service.findAccessTokens()).find((token) => token.clientId === otherClient.id)?.id;
		const other = await openSubscription(otherClient.id, otherGrant.id, otherAccessId);

		const revoked = await service.revokeGrant(grant.id, 'actor-id');

		expect(revoked).toMatchObject({ id: grant.id, active: false });
		expect(matching.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(
			await dataSource
				.getRepository(McpOAuthProviderRevokedGrantEntity)
				.existsBy({ grantIdHash: grant.providerGrantIdHash }),
		).toBe(true);
	});

	it('disables a client, revokes its artifacts, and preserves other clients', async () => {
		const matching = await openSubscription(client.id, grant.id, accessId, familyId);
		const otherAccessId = (await service.findAccessTokens()).find((token) => token.clientId === otherClient.id)?.id;
		const other = await openSubscription(otherClient.id, otherGrant.id, otherAccessId);

		const disabled = await service.disableClient(client.id, 'actor-id');

		expect(disabled.enabled).toBe(false);
		expect(matching.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect((await service.getGrant(grant.id)).active).toBe(false);
		expect(await service.findAccessTokens()).toEqual([expect.objectContaining({ clientId: otherClient.id })]);
	});

	it('preserves metadata updates when a client is disabled through PATCH', async () => {
		const disabled = await service.updateClient(
			client.id,
			{
				name: 'Codex CLI',
				redirectUris: ['http://127.0.0.1:6789/oauth/callback'],
				maximumScopes: [McpOAuthScope.READ],
				enabled: false,
			},
			'actor-id',
		);

		expect(disabled).toMatchObject({
			name: 'Codex CLI',
			redirectUris: ['http://127.0.0.1:6789/oauth/callback'],
			maximumScopes: [McpOAuthScope.READ],
			enabled: false,
		});
		expect((await dataSource.getRepository(McpOAuthClientEntity).findOneByOrFail({ id: client.id })).generation).toBe(
			1,
		);
		expect((await service.getGrant(grant.id)).active).toBe(false);
		expect(await service.findAccessTokens()).toEqual([expect.objectContaining({ clientId: otherClient.id })]);
	});

	async function openSubscription(clientId: string, grantId: string, tokenId: string, refreshFamilyId?: string) {
		return subscriptions.openOAuth(`request-${tokenId}`, () =>
			Promise.resolve({
				clientId,
				binding: {
					accessTokenId: tokenId,
					grantId,
					...(refreshFamilyId ? { refreshFamilyId } : {}),
					authorizationDeadline: new Date(Date.now() + 60_000),
					effectiveScopes: [McpOAuthScope.READ],
					modulePolicyGeneration: 0,
					clientGeneration: 0,
					grantGeneration: 0,
				},
			}),
		);
	}
});
