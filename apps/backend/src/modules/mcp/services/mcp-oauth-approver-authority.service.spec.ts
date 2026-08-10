import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthApproverAuthorityService } from './mcp-oauth-approver-authority.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpOAuthApproverAuthorityService', () => {
	let dataSource: DataSource;
	let subscriptions: McpSubscriptionRegistryService;
	let service: McpOAuthApproverAuthorityService;
	let approver: UserEntity;
	let otherApprover: UserEntity;
	let grant: McpOAuthGrantEntity;
	let otherGrant: McpOAuthGrantEntity;

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
				McpOAuthProviderRevokedGrantEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		const audit = { recordSubscriptionClosed: jest.fn(), recordSubscriptionOpened: jest.fn() };
		subscriptions = new McpSubscriptionRegistryService(audit as unknown as McpAuditService);
		service = new McpOAuthApproverAuthorityService(
			dataSource.getRepository(McpOAuthApproverAuthorityEntity),
			dataSource,
			subscriptions,
		);
		const users = dataSource.getRepository(UserEntity);
		approver = await users.save(users.create(user('approver', UserRole.ADMIN)));
		otherApprover = await users.save(users.create(user('other-approver', UserRole.OWNER)));
		const clients = dataSource.getRepository(McpOAuthClientEntity);
		const client = await clients.save(
			clients.create({
				clientIdentifier: uuid(),
				name: 'Codex',
				redirectUris: ['http://127.0.0.1:1455/callback'],
				maximumScopes: [McpOAuthScope.READ],
				enabled: true,
				generation: 0,
				createdById: approver.id,
			}),
		);
		const grants = dataSource.getRepository(McpOAuthGrantEntity);
		grant = await grants.save(grants.create(grantInput(client.id, approver.id, 'grant-one')));
		otherGrant = await grants.save(grants.create(grantInput(client.id, otherApprover.id, 'grant-two')));
		const artifacts = dataSource.getRepository(McpOAuthProviderArtifactEntity);
		await artifacts.save([
			artifacts.create(artifactInput(grant.providerGrantIdHash)),
			artifacts.create(artifactInput(otherGrant.providerGrantIdHash)),
			artifacts.create(providerGrantArtifactInput(grant.providerGrantIdHash)),
			artifacts.create(providerGrantArtifactInput(otherGrant.providerGrantIdHash)),
		]);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await subscriptions.closeAll();
		await dataSource.destroy();
	});

	it('advances authority, revokes approved grants and artifacts, and closes only matching streams', async () => {
		const matching = await openSubscription(approver.id, grant.id);
		const other = await openSubscription(otherApprover.id, otherGrant.id);
		const staticStream = subscriptions.open('static-client');

		await service.invalidateApprover(approver.id);

		expect(await service.getGeneration(approver.id)).toBe(1);
		expect(
			(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).revokedAt,
		).not.toBeNull();
		expect(
			(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: otherGrant.id })).revokedAt,
		).toBeNull();
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
				.existsBy({ grantIdHash: otherGrant.providerGrantIdHash }),
		).toBe(true);
		expect(
			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.existsBy({ model: 'Grant', idHash: otherGrant.providerGrantIdHash }),
		).toBe(true);
		expect(matching.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes approver streams and propagates an invalidation failure', async () => {
		const matching = await openSubscription(approver.id, grant.id);
		jest.spyOn(dataSource, 'transaction').mockRejectedValue(new Error('database unavailable'));

		await expect(service.invalidateApprover(approver.id)).rejects.toThrow('database unavailable');

		expect(matching.signal.aborted).toBe(true);
		expect(await service.getGeneration(approver.id)).toBe(0);
	});

	it('rolls back both demotion and invalidation when the atomic user commit fails', async () => {
		const next = Object.assign(new UserEntity(), approver, { role: UserRole.USER });
		const matching = await openSubscription(approver.id, grant.id);

		await expect(
			service.update(approver, next, async (manager) => {
				await manager?.getRepository(UserEntity).update({ id: approver.id }, { role: UserRole.USER });
				throw new Error('user update failed');
			}),
		).rejects.toThrow('user update failed');

		expect((await dataSource.getRepository(UserEntity).findOneByOrFail({ id: approver.id })).role).toBe(UserRole.ADMIN);
		expect(await service.getGeneration(approver.id)).toBe(0);
		expect(
			(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).revokedAt,
		).toBeNull();
		expect(matching.signal.aborted).toBe(true);
	});

	it('keeps deletion inside the gate so queued consent observes the removed user', async () => {
		let commitStarted = (): void => undefined;
		const started = new Promise<void>((resolve) => {
			commitStarted = resolve;
		});
		let releaseCommit = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseCommit = resolve;
		});
		const removal = service.remove(approver, async (manager) => {
			await manager?.getRepository(UserEntity).delete(approver.id);
			commitStarted();
			await release;
		});

		await started;
		const queuedConsent = expect(service.runAuthorized(approver.id, () => Promise.resolve('grant'))).rejects.toThrow(
			'no longer authorized',
		);
		releaseCommit();

		await removal;
		await queuedConsent;
		expect(await dataSource.getRepository(UserEntity).findOneBy({ id: approver.id })).toBeNull();
	});

	it('preserves authority generations for authorized profile updates', async () => {
		const next = Object.assign(new UserEntity(), approver, { firstName: 'Updated' });
		const commit = jest.fn().mockResolvedValue(next);

		await expect(service.update(approver, next, commit)).resolves.toBe(next);

		expect(commit).toHaveBeenCalledWith();
		expect(await service.getGeneration(approver.id)).toBe(0);
		expect(
			(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).revokedAt,
		).toBeNull();
	});

	it('rejects a consent queued behind approver invalidation and keeps restored roles on the new generation', async () => {
		await dataSource.getRepository(UserEntity).update({ id: approver.id }, { role: UserRole.USER });
		const invalidation = service.invalidateApprover(approver.id);
		const queuedConsent = expect(service.runAuthorized(approver.id, () => Promise.resolve('grant'))).rejects.toThrow(
			'no longer authorized',
		);

		await invalidation;
		await queuedConsent;
		await dataSource.getRepository(UserEntity).update({ id: approver.id }, { role: UserRole.ADMIN });

		await expect(service.runAuthorized(approver.id, (generation) => Promise.resolve(generation))).resolves.toBe(1);
	});

	it('lets a consent that wins the gate finish before invalidating its resulting authority generation', async () => {
		let release = (): void => undefined;
		const paused = new Promise<void>((resolve) => {
			release = resolve;
		});
		let operationStarted = (): void => undefined;
		const started = new Promise<void>((resolve) => {
			operationStarted = resolve;
		});
		const consent = service.runAuthorized(approver.id, async (generation) => {
			operationStarted();
			await paused;
			return generation;
		});

		await started;
		const invalidation = service.invalidateApprover(approver.id);
		release();

		await expect(consent).resolves.toBe(0);
		await invalidation;
		expect(await service.getGeneration(approver.id)).toBe(1);
	});

	function user(username: string, role: UserRole): Partial<UserEntity> {
		return {
			username,
			password: null,
			email: null,
			firstName: null,
			lastName: null,
			role,
			language: UserLanguage.EN,
			isHidden: false,
		};
	}

	function grantInput(clientId: string, approvedById: string, providerId: string): Partial<McpOAuthGrantEntity> {
		return {
			providerGrantIdHash: hashToken(providerId),
			clientId,
			approvedById,
			installationId: uuid(),
			issuer: 'https://panel.example.com/api/v1/modules/mcp/oauth',
			resource: 'https://panel.example.com/api/v1/modules/mcp',
			approvedScopes: [McpOAuthScope.READ],
			expiresAt: new Date(Date.now() + 60_000),
			revokedAt: null,
			generation: 0,
			approverAuthorityGeneration: 0,
		};
	}

	function artifactInput(grantIdHash: string): Partial<McpOAuthProviderArtifactEntity> {
		return {
			model: 'AccessToken',
			idHash: hashToken(uuid()),
			managementId: uuid(),
			payload: JSON.stringify({ scope: 'mcp:read' }),
			grantIdHash,
			refreshFamilyId: null,
			userCodeHash: null,
			uidHash: null,
			consumedAt: null,
			expiresAt: Date.now() + 60_000,
		};
	}

	function providerGrantArtifactInput(grantIdHash: string): Partial<McpOAuthProviderArtifactEntity> {
		return {
			model: 'Grant',
			idHash: grantIdHash,
			managementId: uuid(),
			payload: JSON.stringify({ accountId: approver.id }),
			grantIdHash: null,
			refreshFamilyId: null,
			userCodeHash: null,
			uidHash: null,
			consumedAt: null,
			expiresAt: Date.now() + 60_000,
		};
	}

	async function openSubscription(approverId: string, grantId: string) {
		return subscriptions.openOAuth(uuid(), () =>
			Promise.resolve({
				clientId: uuid(),
				binding: {
					accessTokenId: uuid(),
					approverAuthorityGeneration: 0,
					approverId,
					grantId,
					authorizationDeadline: new Date(Date.now() + 60_000),
					effectiveScopes: [McpOAuthScope.READ],
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
