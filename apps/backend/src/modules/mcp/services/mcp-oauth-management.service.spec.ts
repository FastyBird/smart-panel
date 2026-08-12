import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { hashToken } from '../../auth/utils/token.utils';
import { ConfigService } from '../../config/services/config.service';
import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRefreshFamilyLineageEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import { MCP_OAUTH_SERVER_STATE_KEY, McpOAuthScope } from '../mcp.constants';
import { McpOAuthClientModel } from '../models/mcp-oauth-client.model';
import { createMcpOAuthProviderAdapter } from '../oauth/mcp-oauth-provider.adapter';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthClientService } from './mcp-oauth-client.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthManagementService } from './mcp-oauth-management.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

const deferred = <T = void>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve = (_value: T): void => undefined;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});

	return { promise, resolve };
};

describe('McpOAuthManagementService', () => {
	let dataSource: DataSource;
	let grantRepository: Repository<McpOAuthGrantEntity>;
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
		recordOAuthGlobalRevocation: jest.Mock;
		recordOAuthManagementAction: jest.Mock;
		recordSubscriptionClosed: jest.Mock;
		recordSubscriptionOpened: jest.Mock;
	};
	let globalInvalidation: { invalidate: jest.Mock };

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpOAuthApproverAuthorityEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthProviderArtifactEntity,
				McpOAuthProviderRefreshFamilyLineageEntity,
				McpOAuthProviderRevokedGrantEntity,
				McpOAuthProviderRevokedRefreshFamilyEntity,
				McpOAuthServerStateEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		auditService = {
			recordOAuthGlobalRevocation: jest.fn(),
			recordOAuthManagementAction: jest.fn(),
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		globalInvalidation = {
			invalidate: jest.fn(async (_generations: string[], commit: () => Promise<void>) => commit()),
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
		grantRepository = grants;
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
				model: 'Grant',
				idHash: grant.providerGrantIdHash,
				managementId: uuid(),
				payload: JSON.stringify({ accountId: user.id, clientId: client.clientIdentifier }),
				grantIdHash: null,
				refreshFamilyId: null,
				userCodeHash: null,
				uidHash: null,
				consumedAt: null,
				expiresAt: Date.now() + 60_000,
			}),
			artifacts.create({
				model: 'Grant',
				idHash: otherGrant.providerGrantIdHash,
				managementId: uuid(),
				payload: JSON.stringify({ accountId: user.id, clientId: otherClient.clientIdentifier }),
				grantIdHash: null,
				refreshFamilyId: null,
				userCodeHash: null,
				uidHash: null,
				consumedAt: null,
				expiresAt: Date.now() + 60_000,
			}),
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
		await dataSource.getRepository(McpOAuthProviderRefreshFamilyLineageEntity).save({
			grantIdHash: grant.providerGrantIdHash,
			refreshFamilyId: familyId,
		});
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
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
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

	it('revokes all OAuth authorization through the global server-security epoch and audits success', async () => {
		await service.revokeAll('actor-id');

		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['serverSecretVersion'], expect.any(Function));
		expect(auditService.recordOAuthGlobalRevocation).toHaveBeenCalledWith('actor-id');
	});

	it('does not audit a failed global OAuth revocation', async () => {
		const failure = new Error('global invalidation failed');
		globalInvalidation.invalidate.mockRejectedValueOnce(failure);

		await expect(service.revokeAll('actor-id')).rejects.toBe(failure);

		expect(auditService.recordOAuthGlobalRevocation).not.toHaveBeenCalled();
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
			{
				grantId: 'grant-one',
				clientId: client.clientIdentifier,
				scope: 'mcp:read offline_access',
				gty: 'authorization_code refresh_token',
				rotations: 1,
			},
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

	it('rejects a refresh successor after its revoked family artifacts have already been deleted', async () => {
		const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
			allowTestInMemory: true,
		});
		const refreshAdapter = new Adapter('RefreshToken');

		await service.revokeRefreshFamily(familyId, 'actor-id');

		await expect(
			refreshAdapter.upsert(
				'late-refresh-successor',
				{
					grantId: 'grant-one',
					clientId: client.clientIdentifier,
					scope: 'mcp:read offline_access',
					gty: 'authorization_code refresh_token',
					rotations: 1,
				},
				60,
			),
		).rejects.toThrow('already consumed');
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
		expect(
			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.existsBy({ grantIdHash: grant.providerGrantIdHash }),
		).toBe(false);
		expect(
			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.existsBy({ model: 'Grant', idHash: grant.providerGrantIdHash }),
		).toBe(false);
		expect(
			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.existsBy({ model: 'Grant', idHash: otherGrant.providerGrantIdHash }),
		).toBe(true);
	});

	it('reduces approved grant scopes and closes only matching contracted subscriptions', async () => {
		await grantRepository.update(
			{ id: grant.id },
			{ approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.OFFLINE_ACCESS] },
		);
		const matchingRead = await openSubscription(client.id, grant.id, accessId, familyId, [McpOAuthScope.READ]);
		const matchingWrite = await openSubscription(client.id, grant.id, uuid(), undefined, [
			McpOAuthScope.READ,
			McpOAuthScope.WRITE,
		]);
		const other = await openSubscription(otherClient.id, otherGrant.id, uuid(), undefined, [
			McpOAuthScope.READ,
			McpOAuthScope.WRITE,
		]);

		const updated = await service.updateGrant(
			grant.id,
			{ approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS] },
			'actor-id',
		);

		expect(updated.approvedScopes).toEqual([McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS]);
		expect((await grantRepository.findOneByOrFail({ id: grant.id })).generation).toBe(1);
		expect(matchingRead.signal.aborted).toBe(false);
		expect(matchingWrite.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(auditService.recordOAuthManagementAction).toHaveBeenCalledWith(
			'actor-id',
			'grant',
			grant.id,
			'scopes_updated',
		);
	});

	it('rejects grant scope expansion without changing its generation', async () => {
		await expect(
			service.updateGrant(
				grant.id,
				{ approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.OFFLINE_ACCESS] },
				'actor-id',
			),
		).rejects.toThrow('can only be reduced');

		expect((await grantRepository.findOneByOrFail({ id: grant.id })).generation).toBe(0);
	});

	it('requires revocation to remove offline access', async () => {
		await expect(service.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.READ] }, 'actor-id')).rejects.toThrow(
			'offline_access can only be removed by revoking',
		);

		expect((await grantRepository.findOneByOrFail({ id: grant.id })).generation).toBe(0);
	});

	it('validates a queued grant reduction against the latest authorized scopes', async () => {
		await grantRepository.update(
			{ id: grant.id },
			{ approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE], generation: 0 },
		);
		const mutationStarted = deferred();
		const releaseMutation = deferred();
		const precedingMutation = subscriptions.closeOAuthGrant(grant.id, async () => {
			mutationStarted.resolve();
			await releaseMutation.promise;
			await grantRepository.update(
				{ id: grant.id, generation: 0 },
				{ approvedScopes: [McpOAuthScope.READ], generation: () => 'generation + 1' },
			);
		});

		await mutationStarted.promise;
		const queuedUpdate = expect(
			service.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.WRITE] }, 'actor-id'),
		).rejects.toThrow('can only be reduced');
		releaseMutation.resolve();
		await precedingMutation;
		await queuedUpdate;

		expect(await grantRepository.findOneByOrFail({ id: grant.id })).toMatchObject({
			approvedScopes: [McpOAuthScope.READ],
			generation: 1,
		});
	});

	it('does not close grant streams when the conditional scope update fails', async () => {
		await grantRepository.update({ id: grant.id }, { approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE] });
		const matching = await openSubscription(client.id, grant.id, accessId, familyId, [
			McpOAuthScope.READ,
			McpOAuthScope.WRITE,
		]);
		jest.spyOn(grantRepository, 'update').mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

		await expect(service.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.READ] }, 'actor-id')).rejects.toThrow(
			'changed during scope update',
		);

		expect(matching.signal.aborted).toBe(false);
	});

	it('closes a contracted grant registration that wins the gate before the scope update', async () => {
		await grantRepository.update({ id: grant.id }, { approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE] });
		const revalidationStarted = deferred();
		const releaseRevalidation = deferred();
		const registration = subscriptions.openOAuth('winning-grant-registration', async () => {
			revalidationStarted.resolve();
			await releaseRevalidation.promise;

			return {
				clientId: client.id,
				binding: {
					accessTokenId: accessId,
					approverAuthorityGeneration: 0,
					approverId: grant.approvedById,
					grantId: grant.id,
					authorizationDeadline: new Date(Date.now() + 60_000),
					effectiveScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE],
					modulePolicyGeneration: 0,
					oauthEnabledGeneration: 0,
					publicIdentityGeneration: 0,
					serverSecretVersion: 1,
					clientGeneration: 0,
					grantGeneration: 0,
				},
			};
		});

		await revalidationStarted.promise;

		const mutation = service.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.READ] }, 'actor-id');
		await Promise.resolve();
		expect((await grantRepository.findOneByOrFail({ id: grant.id })).generation).toBe(0);

		releaseRevalidation.resolve();
		const winning = await registration;
		await mutation;

		expect(winning.signal.aborted).toBe(true);
		expect((await grantRepository.findOneByOrFail({ id: grant.id })).generation).toBe(1);
	});

	it('makes a registration queued behind grant reduction observe the updated generation and scopes', async () => {
		await grantRepository.update({ id: grant.id }, { approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE] });
		const matching = await openSubscription(client.id, grant.id, accessId, familyId, [
			McpOAuthScope.READ,
			McpOAuthScope.WRITE,
		]);
		const updateStarted = deferred();
		const releaseUpdate = deferred();
		const updateSpy = jest.spyOn(grantRepository, 'update');
		updateSpy.mockImplementationOnce(async (criteria, partialEntity) => {
			updateStarted.resolve();
			await releaseUpdate.promise;
			updateSpy.mockRestore();

			return grantRepository.update(criteria as FindOptionsWhere<McpOAuthGrantEntity>, partialEntity);
		});
		const mutation = service.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.READ] }, 'actor-id');

		await updateStarted.promise;

		const observed: Array<{ generation: number; scopes: McpOAuthScope[] }> = [];
		const registration = subscriptions.openOAuth('queued-grant-registration', async () => {
			const liveGrant = await grantRepository.findOneByOrFail({ id: grant.id });
			observed.push({ generation: liveGrant.generation, scopes: [...liveGrant.approvedScopes] });

			return {
				clientId: client.id,
				binding: {
					accessTokenId: uuid(),
					approverAuthorityGeneration: 0,
					approverId: grant.approvedById,
					grantId: grant.id,
					authorizationDeadline: new Date(Date.now() + 60_000),
					effectiveScopes: [McpOAuthScope.READ],
					modulePolicyGeneration: 0,
					oauthEnabledGeneration: 0,
					publicIdentityGeneration: 0,
					serverSecretVersion: 1,
					clientGeneration: 0,
					grantGeneration: liveGrant.generation,
				},
			};
		});
		await Promise.resolve();
		expect(observed).toEqual([]);

		releaseUpdate.resolve();
		await mutation;
		const queued = await registration;

		expect(observed).toEqual([{ generation: 1, scopes: [McpOAuthScope.READ] }]);
		expect(matching.signal.aborted).toBe(true);
		expect(queued.signal.aborted).toBe(false);
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

	it('gates authorization-field updates even when they match the initial client snapshot', async () => {
		const matching = await openSubscription(client.id, grant.id, accessId, familyId);

		const updated = await service.updateClient(client.id, { maximumScopes: [...client.maximumScopes] }, 'actor-id');

		expect(updated.maximumScopes).toEqual(client.maximumScopes);
		expect(matching.signal.aborted).toBe(true);
	});

	async function openSubscription(
		clientId: string,
		grantId: string,
		tokenId: string,
		refreshFamilyId?: string,
		effectiveScopes: McpOAuthScope[] = [McpOAuthScope.READ],
	) {
		return subscriptions.openOAuth(`request-${tokenId}`, () =>
			Promise.resolve({
				clientId,
				binding: {
					accessTokenId: tokenId,
					approverAuthorityGeneration: 0,
					approverId: grant.approvedById,
					grantId,
					...(refreshFamilyId ? { refreshFamilyId } : {}),
					authorizationDeadline: new Date(Date.now() + 60_000),
					effectiveScopes,
					modulePolicyGeneration: 0,
					oauthEnabledGeneration: 0,
					publicIdentityGeneration: 0,
					serverSecretVersion: 1,
					clientGeneration: 0,
					grantGeneration: 0,
				},
			}),
		);
	}
});
