import { DataSource } from 'typeorm';

import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
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
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import { MCP_OAUTH_SERVER_STATE_KEY, McpOAuthScope } from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpSubscriptionClosingError, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
	let resolve = (): void => undefined;
	const promise = new Promise<void>((resolver) => {
		resolve = resolver;
	});

	return { promise, resolve };
};

describe('McpOAuthGlobalInvalidationService', () => {
	let dataSource: DataSource;
	let subscriptions: McpSubscriptionRegistryService;
	let service: McpOAuthGlobalInvalidationService;
	let grant: McpOAuthGrantEntity;

	beforeEach(async () => {
		dataSource = new DataSource({
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
				McpOAuthRefreshTokenEntity,
				McpOAuthRefreshTokenFamilyEntity,
				McpOAuthServerStateEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		const user = await dataSource.getRepository(UserEntity).save({
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
			clientIdentifier: 'public-client',
			name: 'Codex',
			redirectUris: ['http://127.0.0.1/callback'],
			maximumScopes: [McpOAuthScope.READ],
			enabled: true,
			generation: 0,
			createdById: user.id,
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
		grant = await dataSource.getRepository(McpOAuthGrantEntity).save({
			providerGrantIdHash: 'provider-grant-hash',
			clientId: client.id,
			approvedById: user.id,
			installationId: 'installation-id',
			issuer: 'https://panel.example.com/oauth',
			resource: 'https://panel.example.com/mcp',
			approvedScopes: [McpOAuthScope.READ],
			expiresAt: new Date(Date.now() + 60_000),
			revokedAt: null,
			generation: 0,
			approverAuthorityGeneration: 0,
			oauthEnabledGeneration: 0,
			serverSecretVersion: 1,
			publicIdentityGeneration: 0,
			clientGeneration: 0,
			modulePolicyGeneration: 0,
		});
		await dataSource.getRepository(McpOAuthProviderArtifactEntity).save({
			model: 'AccessToken',
			idHash: 'access-token-hash',
			managementId: 'access-token-id',
			payload: JSON.stringify({ scope: 'mcp:read' }),
			grantIdHash: grant.providerGrantIdHash,
			refreshFamilyId: 'refresh-family-id',
			userCodeHash: null,
			uidHash: null,
			consumedAt: null,
			expiresAt: Date.now() + 60_000,
			oauthEnabledGeneration: 0,
			serverSecretVersion: 1,
			publicIdentityGeneration: 0,
			clientGeneration: 0,
			grantGeneration: 0,
			modulePolicyGeneration: 0,
			approverAuthorityGeneration: 0,
		});
		await dataSource.getRepository(McpOAuthProviderRefreshFamilyLineageEntity).save({
			grantIdHash: grant.providerGrantIdHash,
			refreshFamilyId: 'refresh-family-id',
		});
		const auditService = {
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		subscriptions = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);
		service = new McpOAuthGlobalInvalidationService(dataSource, subscriptions);
	});

	afterEach(async () => {
		await subscriptions.closeAll();
		await dataSource.destroy();
	});

	it('advances identity state, revokes every OAuth artifact, and preserves static streams', async () => {
		const staticStream = subscriptions.open('static-client');
		const oauthStream = await openOAuthSubscription();
		const commit = jest.fn();

		await service.invalidate(['publicIdentityGeneration'], commit);

		expect(commit).toHaveBeenCalledTimes(1);
		expect(staticStream.signal.aborted).toBe(false);
		expect(oauthStream.signal.aborted).toBe(true);
		expect(
			await dataSource.getRepository(McpOAuthServerStateEntity).findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		).toMatchObject({ publicIdentityGeneration: 1 });
		const revokedGrant = await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id });

		expect(revokedGrant.generation).toBe(1);
		expect(revokedGrant.revokedAt).toBeInstanceOf(Date);
		expect(
			await dataSource
				.getRepository(McpOAuthProviderRevokedGrantEntity)
				.existsBy({ grantIdHash: grant.providerGrantIdHash }),
		).toBe(true);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
		expect(await dataSource.getRepository(McpOAuthProviderRefreshFamilyLineageEntity).count()).toBe(0);
	});

	it('advances the server-security epoch while preserving static streams', async () => {
		const staticStream = subscriptions.open('static-client');
		const oauthStream = await openOAuthSubscription();

		await service.invalidate(['serverSecretVersion'], () => Promise.resolve());

		expect(staticStream.signal.aborted).toBe(false);
		expect(oauthStream.signal.aborted).toBe(true);
		expect(
			await dataSource.getRepository(McpOAuthServerStateEntity).findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		).toMatchObject({ serverSecretVersion: 2 });
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
	});

	it('advances OAuth enablement, revokes artifacts, and closes static and OAuth streams before disable completes', async () => {
		const staticStream = subscriptions.open('static-client');
		const oauthStream = await openOAuthSubscription();
		const commitStarted = deferred();
		const releaseCommit = deferred();
		const invalidation = service.invalidateAll(['oauthEnabledGeneration'], async () => {
			commitStarted.resolve();
			await releaseCommit.promise;
		});

		await commitStarted.promise;

		expect(() => subscriptions.open('late-static-client')).toThrow(McpSubscriptionClosingError);
		await expect(openOAuthSubscription()).rejects.toBeInstanceOf(McpSubscriptionClosingError);
		expect(staticStream.signal.aborted).toBe(false);
		expect(oauthStream.signal.aborted).toBe(false);

		releaseCommit.resolve();
		await invalidation;

		expect(staticStream.signal.aborted).toBe(true);
		expect(oauthStream.signal.aborted).toBe(true);
		expect(
			await dataSource.getRepository(McpOAuthServerStateEntity).findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		).toMatchObject({ oauthEnabledGeneration: 1 });
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
	});

	it('does not commit, revoke, or close either stream profile when disable generation state is unavailable', async () => {
		const staticStream = subscriptions.open('static-client');
		const oauthStream = await openOAuthSubscription();
		const commit = jest.fn();
		await dataSource.getRepository(McpOAuthServerStateEntity).delete({ key: MCP_OAUTH_SERVER_STATE_KEY });

		await expect(service.invalidateAll(['oauthEnabledGeneration'], commit)).rejects.toThrow(
			'MCP OAuth oauthEnabledGeneration state is unavailable',
		);

		expect(commit).not.toHaveBeenCalled();
		expect(staticStream.signal.aborted).toBe(false);
		expect(oauthStream.signal.aborted).toBe(false);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(1);
	});

	it('remains fail-closed and closes OAuth streams when the external commit fails', async () => {
		const staticStream = subscriptions.open('static-client');
		const oauthStream = await openOAuthSubscription();
		const commitError = new Error('configuration persistence failed');

		await expect(service.invalidate(['publicIdentityGeneration'], () => Promise.reject(commitError))).rejects.toBe(
			commitError,
		);

		expect(staticStream.signal.aborted).toBe(false);
		expect(oauthStream.signal.aborted).toBe(true);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
		expect(
			await dataSource.getRepository(McpOAuthServerStateEntity).findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY }),
		).toMatchObject({ publicIdentityGeneration: 1 });
	});

	it.each([undefined, null])('propagates a falsy external commit failure (%s)', async (commitError) => {
		let rejected = false;

		try {
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Regression coverage requires falsy rejection reasons.
			await service.invalidate(['publicIdentityGeneration'], () => Promise.reject(commitError));
		} catch (error) {
			rejected = true;
			expect(error).toBe(commitError);
		}

		expect(rejected).toBe(true);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
	});

	it('holds queued OAuth work until identity advancement and revocation complete', async () => {
		const commitStarted = deferred();
		const releaseCommit = deferred();
		const invalidation = service.invalidate(['publicIdentityGeneration'], async () => {
			commitStarted.resolve();
			await releaseCommit.promise;
		});

		await commitStarted.promise;

		const observedGenerations: number[] = [];
		const queuedMutation = subscriptions.runOAuthMutation(async () => {
			const state = await dataSource
				.getRepository(McpOAuthServerStateEntity)
				.findOneByOrFail({ key: MCP_OAUTH_SERVER_STATE_KEY });
			observedGenerations.push(state.publicIdentityGeneration);
		});
		await Promise.resolve();

		expect(observedGenerations).toEqual([]);
		releaseCommit.resolve();
		await invalidation;
		await queuedMutation;

		expect(observedGenerations).toEqual([1]);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(0);
	});

	it('does not commit, revoke, or close streams when persistent generation state is unavailable', async () => {
		const oauthStream = await openOAuthSubscription();
		const commit = jest.fn();
		await dataSource.getRepository(McpOAuthServerStateEntity).delete({ key: MCP_OAUTH_SERVER_STATE_KEY });

		await expect(service.invalidate(['publicIdentityGeneration'], commit)).rejects.toThrow(
			'MCP OAuth publicIdentityGeneration state is unavailable',
		);

		expect(commit).not.toHaveBeenCalled();
		expect(oauthStream.signal.aborted).toBe(false);
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).count()).toBe(1);
		expect(await dataSource.getRepository(McpOAuthGrantEntity).findOneByOrFail({ id: grant.id })).toMatchObject({
			revokedAt: null,
			generation: 0,
		});
	});

	async function openOAuthSubscription() {
		return subscriptions.openOAuth('oauth-request', () =>
			Promise.resolve({
				clientId: 'client-id',
				binding: {
					accessTokenId: 'access-token-id',
					approverAuthorityGeneration: 0,
					approverId: 'approver-id',
					grantId: grant.id,
					refreshFamilyId: 'refresh-family-id',
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
