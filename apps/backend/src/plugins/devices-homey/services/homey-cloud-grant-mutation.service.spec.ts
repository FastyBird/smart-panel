import { DataSource } from 'typeorm';

import { UserEntity } from '../../../modules/users/entities/users.entity';
import { UserRole } from '../../../modules/users/users.constants';
import {
	HOMEY_CLOUD_ACTIVE_GRANT_KEY,
	HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
	HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS,
	HOMEY_CLOUD_RUNTIME_TEARDOWN_RETRY_INITIAL_MS,
} from '../devices-homey.constants';
import {
	HomeyCloudActiveGrantEntity,
	HomeyCloudAuthorizationStateEntity,
	HomeyCloudCancelledAuthorizationEntity,
	HomeyCloudPendingGrantEntity,
	HomeyCloudUserAuthorityEntity,
} from '../entities/homey-cloud-grant.entity';
import { HomeyCloudAuthorizationCapacityError } from '../errors/homey-cloud-authorization.error';
import {
	HomeyCloudGrantAuthorityError,
	HomeyCloudGrantConflictError,
	HomeyCloudGrantStateError,
} from '../errors/homey-cloud-grant.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import { HomeyCloudCredentialCipherService } from './homey-cloud-credential-cipher.service';
import { HomeyCloudGrantMutationService, HomeyCloudTokenMaterial } from './homey-cloud-grant-mutation.service';
import { HomeyCloudRuntimeRegistryService } from './homey-cloud-runtime-registry.service';

describe('HomeyCloudGrantMutationService', () => {
	const administratorId = '11111111-1111-4111-8111-111111111111';
	const otherAdministratorId = '22222222-2222-4222-8222-222222222222';
	let dataSource: DataSource;
	let service: HomeyCloudGrantMutationService;
	let configurationFingerprint: string | null;
	let clientConfig: jest.Mocked<
		Pick<HomeyCloudClientConfigService, 'getConfiguration' | 'getConfigurationFingerprint'>
	>;
	let credentialCipher: HomeyCloudCredentialCipherService;
	let runtimeRegistry: jest.Mocked<Pick<HomeyCloudRuntimeRegistryService, 'disconnectGrant'>>;

	beforeEach(async () => {
		configurationFingerprint = 'configuration-one';
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				HomeyCloudAuthorizationStateEntity,
				HomeyCloudUserAuthorityEntity,
				HomeyCloudPendingGrantEntity,
				HomeyCloudCancelledAuthorizationEntity,
				HomeyCloudActiveGrantEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		await createUser(administratorId, 'administrator');
		await createUser(otherAdministratorId, 'other-administrator');
		runtimeRegistry = { disconnectGrant: jest.fn().mockResolvedValue(undefined) };
		clientConfig = {
			getConfiguration: jest.fn(() => ({
				clientId: 'client-id',
				clientSecret: 'deployment-owned-client-secret',
				redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			})),
			getConfigurationFingerprint: jest.fn(() => configurationFingerprint),
		};
		credentialCipher = new HomeyCloudCredentialCipherService(clientConfig as unknown as HomeyCloudClientConfigService);
		service = new HomeyCloudGrantMutationService(
			dataSource,
			clientConfig as unknown as HomeyCloudClientConfigService,
			credentialCipher,
			runtimeRegistry as unknown as HomeyCloudRuntimeRegistryService,
		);
	});

	afterEach(async () => {
		service.onModuleDestroy();
		await dataSource.destroy();
	});

	it('persists isolated candidate credentials behind explicit secret reads', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const candidate = candidateInput(context, 'transaction-one', token('candidate'));
		const { expiresAt } = await service.stageCandidate(candidate);
		const ordinaryRead = await dataSource
			.getRepository(HomeyCloudPendingGrantEntity)
			.findOneByOrFail({ transactionId: candidate.transactionId });

		expect(ordinaryRead.accessToken).toBeUndefined();
		expect(ordinaryRead.refreshToken).toBeUndefined();
		expect(ordinaryRead.tokenType).toBeUndefined();
		const stored = await findPendingWithCredentials(candidate.transactionId);
		expect(stored.accessToken).not.toContain(candidate.token.accessToken);
		expect(stored.refreshToken).not.toContain(candidate.token.refreshToken);
		expect(credentialCipher.isEncrypted(stored.accessToken)).toBe(true);
		expect(credentialCipher.isEncrypted(stored.refreshToken ?? '')).toBe(true);
		await expect(service.loadCandidateCredentials(candidate.transactionId, administratorId)).resolves.toEqual({
			...candidate,
			expiresAt,
		});
	});

	it('upgrades legacy plaintext candidate credentials during an authorized read', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const candidate = candidateInput(context, 'legacy-candidate', token('legacy-candidate'));
		await service.stageCandidate(candidate);
		await dataSource.getRepository(HomeyCloudPendingGrantEntity).update(
			{ transactionId: candidate.transactionId },
			{
				accessToken: candidate.token.accessToken,
				refreshToken: candidate.token.refreshToken,
				credentialsVersion: 0,
			},
		);

		await expect(service.loadCandidateCredentials(candidate.transactionId, administratorId)).resolves.toMatchObject({
			token: candidate.token,
		});

		const stored = await findPendingWithCredentials(candidate.transactionId);
		expect(credentialCipher.isEncrypted(stored.accessToken)).toBe(true);
		expect(credentialCipher.isEncrypted(stored.refreshToken ?? '')).toBe(true);
		expect(stored.credentialsVersion).toBe(1);
	});

	it('revalidates authority and deployment generations before provider exchange', async () => {
		const context = await service.getAuthorizationContext(administratorId);

		await expect(service.validateAuthorizationContext(context)).resolves.toBeUndefined();

		configurationFingerprint = 'configuration-two';

		await expect(service.validateAuthorizationContext(context)).rejects.toThrow(HomeyCloudGrantConflictError);
	});

	it('rejects provider exchange after the initiating administrator loses authority', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.invalidateUserAuthority(administratorId, async (manager) => {
			await manager.getRepository(UserEntity).update({ id: administratorId }, { role: UserRole.USER });
		});

		await expect(service.validateAuthorizationContext(context)).rejects.toThrow(HomeyCloudGrantAuthorityError);
	});

	it('keeps the active grant until a generation-matched candidate activates atomically', async () => {
		await expect(service.hasActiveGrant()).resolves.toBe(false);
		const firstContext = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(firstContext, 'first-transaction', token('first')));
		const first = await service.activateCandidate('first-transaction', administratorId, 'homey-one');
		await expect(service.hasActiveGrant()).resolves.toBe(true);
		await expect(service.getActiveGrantReference()).resolves.toEqual(first);
		await expect(service.getActiveGrantForTransaction('first-transaction', administratorId)).resolves.toEqual(first);
		await expect(service.getActiveGrantForTransaction('other-transaction', administratorId)).resolves.toBeNull();
		const replacementContext = await service.getAuthorizationContext(otherAdministratorId);
		await service.stageCandidate(candidateInput(replacementContext, 'replacement-transaction', token('replacement')));

		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({ ...first, token: token('first') });

		const replacement = await service.activateCandidate('replacement-transaction', otherAdministratorId, 'homey-two');

		expect(replacement.generation).toBe(first.generation + 1);
		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({
			...replacement,
			token: token('replacement'),
		});
		const stored = await findActiveWithCredentials();
		expect(stored.accessToken).not.toContain('access-replacement');
		expect(stored.refreshToken).not.toContain('refresh-replacement');
		expect(credentialCipher.isEncrypted(stored.accessToken)).toBe(true);
		expect(credentialCipher.isEncrypted(stored.refreshToken ?? '')).toBe(true);
		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
	});

	it('upgrades legacy plaintext active-grant credentials during a runtime read', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const material = token('legacy-active');
		await service.stageCandidate(candidateInput(context, 'legacy-active', material));
		const active = await service.activateCandidate('legacy-active', administratorId, 'homey-one');
		await dataSource
			.getRepository(HomeyCloudActiveGrantEntity)
			.update(
				{ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY },
				{ accessToken: material.accessToken, refreshToken: material.refreshToken, credentialsVersion: 0 },
			);

		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({ ...active, token: material });

		const stored = await findActiveWithCredentials();
		expect(credentialCipher.isEncrypted(stored.accessToken)).toBe(true);
		expect(credentialCipher.isEncrypted(stored.refreshToken ?? '')).toBe(true);
		expect(stored.credentialsVersion).toBe(1);
	});

	it('fails closed when an encrypted grant is downgraded to plaintext or has an unknown version', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'downgrade-active', token('downgrade-active')));
		await service.activateCandidate('downgrade-active', administratorId, 'homey-one');
		await dataSource
			.getRepository(HomeyCloudActiveGrantEntity)
			.update({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY }, { credentialsVersion: 0 });

		await expect(service.loadActiveGrantCredentials()).rejects.toThrow(HomeyCloudGrantStateError);

		await dataSource
			.getRepository(HomeyCloudActiveGrantEntity)
			.update({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY }, { accessToken: 'stripped-envelope', credentialsVersion: 1 });

		await expect(service.loadActiveGrantCredentials()).rejects.toThrow(HomeyCloudGrantStateError);

		await dataSource
			.getRepository(HomeyCloudActiveGrantEntity)
			.update({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY }, { credentialsVersion: 2 });
		await expect(service.loadActiveGrantCredentials()).rejects.toThrow(HomeyCloudGrantStateError);
	});

	it('clears a pending candidate before provider access when another activation advances the grant generation', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'winning-transaction', token('winning')));
		await service.stageCandidate(candidateInput(context, 'stale-transaction', token('stale')));

		await service.activateCandidate('winning-transaction', administratorId, 'homey-one');

		await expect(service.loadCandidateCredentials('stale-transaction', administratorId)).rejects.toThrow(
			HomeyCloudGrantConflictError,
		);
		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
	});

	it('clears a candidate that loses its authority generation before activation', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'demoted-transaction', token('demoted')));
		await service.invalidateUserAuthority(administratorId, async (manager) => {
			await manager.getRepository(UserEntity).update({ id: administratorId }, { role: UserRole.USER });
		});

		await expect(service.activateCandidate('demoted-transaction', administratorId, 'homey-one')).rejects.toThrow(
			HomeyCloudGrantConflictError,
		);
		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
	});

	it('discards a late refresh instead of overwriting a newer rotated token', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'refresh-transaction', token('original')));
		const active = await service.activateCandidate('refresh-transaction', administratorId, 'homey-one');
		const refreshedToken = token('refreshed');
		const refreshed = await service.persistRefresh({
			grantIdentifier: active.grantIdentifier,
			generation: active.generation,
			configurationGeneration: active.configurationGeneration,
			token: refreshedToken,
		});

		expect(refreshed?.generation).toBe(active.generation + 1);
		await expect(
			service.persistRefresh({
				grantIdentifier: active.grantIdentifier,
				generation: active.generation,
				configurationGeneration: active.configurationGeneration,
				token: token('late'),
			}),
		).resolves.toBeNull();
		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({
			...refreshed,
			token: refreshedToken,
		});
	});

	it('serializes cancellation ahead of activation and never restores the removed candidate', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'cancelled-transaction', token('cancelled')));

		const cancellation = service.cancelCandidate('cancelled-transaction', administratorId);
		const activation = service.activateCandidate('cancelled-transaction', administratorId, 'homey-one');

		await expect(cancellation).resolves.toBe(true);
		await expect(activation).rejects.toThrow(HomeyCloudGrantConflictError);
		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
	});

	it('records cancellation before a callback can stage credentials', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const candidate = candidateInput(context, 'in-flight-transaction', token('in-flight'));

		await expect(service.cancelAuthorization(candidate.transactionId, administratorId, true)).resolves.toBe(true);
		await expect(service.cancelAuthorization(candidate.transactionId, administratorId, false)).resolves.toBe(false);
		await expect(service.stageCandidate(candidate)).rejects.toThrow(HomeyCloudGrantConflictError);
		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
	});

	it('removes a grant activated by an in-flight callback before cancellation commits', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const transactionId = 'late-cancelled-transaction';
		await service.stageCandidate(candidateInput(context, transactionId, token('late-cancelled')));
		await service.activateCandidate(transactionId, administratorId, 'homey-one');

		await expect(service.cancelAuthorization(transactionId, administratorId, true)).resolves.toBe(true);
		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
	});

	it('expires abandoned candidates at their original absolute deadline', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		const expiresAt = Date.now() + 100;
		await service.stageCandidate({
			...candidateInput(context, 'expiring-transaction', token('expiring')),
			expiresAt,
		});

		await expect(service.expireCandidates(expiresAt)).resolves.toBe(1);
		await expect(service.loadCandidateCredentials('expiring-transaction', administratorId)).rejects.toThrow(
			HomeyCloudGrantConflictError,
		);
	});

	it('rejects a caller-controlled candidate lifetime beyond the server limit', async () => {
		const context = await service.getAuthorizationContext(administratorId);

		await expect(
			service.stageCandidate({
				...candidateInput(context, 'unbounded-transaction', token('unbounded')),
				expiresAt: Date.now() + 60 * 60 * 1000,
			}),
		).rejects.toThrow(HomeyCloudGrantConflictError);
	});

	it('bounds persistent candidates after expired records are swept', async () => {
		const context = await service.getAuthorizationContext(administratorId);

		for (let index = 0; index < HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS; index += 1) {
			await service.stageCandidate(candidateInput(context, `bounded-${index}`, token(`bounded-${index}`)));
		}

		await expect(
			service.stageCandidate(candidateInput(context, 'over-capacity', token('over-capacity'))),
		).rejects.toThrow(HomeyCloudAuthorizationCapacityError);
	});

	it('rechecks current authority before disconnect and retains the active grant on rejection', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'disconnect-transaction', token('active')));
		await service.activateCandidate('disconnect-transaction', administratorId, 'homey-one');
		await dataSource.getRepository(UserEntity).update({ id: otherAdministratorId }, { role: UserRole.USER });

		await expect(service.disconnect(otherAdministratorId)).rejects.toThrow(HomeyCloudGrantAuthorityError);
		await expect(service.loadActiveGrantCredentials()).resolves.not.toBeNull();
		await expect(service.disconnect(administratorId)).resolves.toBe(true);
		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
	});

	it('reports and clears staged authorization state when disconnecting without an active grant', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'pending-disconnect', token('pending-disconnect')));
		await service.cancelAuthorization('cancelled-disconnect', administratorId, true);

		await expect(service.disconnect(administratorId)).resolves.toBe(true);
		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
		await expect(dataSource.getRepository(HomeyCloudCancelledAuthorizationEntity).count()).resolves.toBe(0);
	});

	it('rolls back configuration invalidation when its configuration commit fails', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'config-transaction', token('active')));
		const active = await service.activateCandidate('config-transaction', administratorId, 'homey-one');

		await expect(
			service.invalidateConfiguration(() => Promise.reject(new Error('configuration write failed'))),
		).rejects.toThrow('configuration write failed');
		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({ ...active, token: token('active') });

		await expect(service.invalidateConfiguration(() => Promise.resolve('committed'))).resolves.toBe('committed');
		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
		await expect(
			dataSource.getRepository(HomeyCloudAuthorizationStateEntity).findOneByOrFail({
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
			}),
		).resolves.toMatchObject({ activeGrantGeneration: 3, configurationGeneration: 2 });
	});

	it('invalidates persisted credentials before loading them under changed deployment configuration', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'stale-configuration', token('stale')));
		const active = await service.activateCandidate('stale-configuration', administratorId, 'homey-one');

		configurationFingerprint = 'configuration-two';

		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
		await expect(
			dataSource.getRepository(HomeyCloudAuthorizationStateEntity).findOneByOrFail({
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
			}),
		).resolves.toMatchObject({
			activeGrantGeneration: active.generation + 1,
			configurationGeneration: active.configurationGeneration + 1,
			configurationFingerprint: 'configuration-two',
		});
	});

	it('invalidates persisted credentials when the client configuration becomes incomplete', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'incomplete-configuration', token('stale')));
		const active = await service.activateCandidate('incomplete-configuration', administratorId, 'homey-one');

		configurationFingerprint = null;

		await expect(service.hasActiveGrant()).resolves.toBe(false);
		await expect(
			dataSource.getRepository(HomeyCloudAuthorizationStateEntity).findOneByOrFail({
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
			}),
		).resolves.toMatchObject({
			activeGrantGeneration: active.generation + 1,
			configurationGeneration: active.configurationGeneration + 1,
			configurationFingerprint: null,
		});
	});

	it('invalidates the active grant in the same transaction as its activating user removal', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'removal-transaction', token('active')));
		await service.activateCandidate('removal-transaction', administratorId, 'homey-one');

		await service.invalidateUserAuthority(administratorId, (manager) =>
			manager
				.getRepository(UserEntity)
				.delete({ id: administratorId })
				.then(() => undefined),
		);

		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
		await expect(
			dataSource.getRepository(HomeyCloudUserAuthorityEntity).findOneByOrFail({ userId: administratorId }),
		).resolves.toMatchObject({ generation: 1 });
		await expect(
			dataSource.getRepository(HomeyCloudActiveGrantEntity).findOneBy({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY }),
		).resolves.toBeNull();
	});

	it('rolls back user-authority invalidation when the user mutation fails', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'failed-demotion', token('active')));
		const active = await service.activateCandidate('failed-demotion', administratorId, 'homey-one');

		await expect(
			service.invalidateUserAuthority(administratorId, () => Promise.reject(new Error('user update failed'))),
		).rejects.toThrow('user update failed');
		await expect(service.loadActiveGrantCredentials()).resolves.toEqual({ ...active, token: token('active') });
		await expect(
			dataSource.getRepository(HomeyCloudUserAuthorityEntity).findOneByOrFail({ userId: administratorId }),
		).resolves.toMatchObject({ generation: 0 });
	});

	it('prepares an administrator demotion through the additive user lifecycle boundary', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'participant-demotion', token('active')));
		await service.activateCandidate('participant-demotion', administratorId, 'homey-one');
		const previous = await dataSource.getRepository(UserEntity).findOneByOrFail({ id: administratorId });
		const next = Object.assign(new UserEntity(), previous, { role: UserRole.USER });

		await dataSource.transaction((manager) => service.prepareUpdate(previous, next, manager));
		await service.afterUpdate(previous, next);

		await expect(service.loadActiveGrantCredentials()).resolves.toBeNull();
		expect(runtimeRegistry.disconnectGrant).toHaveBeenCalledTimes(1);
		const shouldDisconnect = runtimeRegistry.disconnectGrant.mock.calls[0]?.[0];
		if (!shouldDisconnect) throw new Error('Homey Cloud runtime teardown guard was not registered');
		await expect(shouldDisconnect()).resolves.toBe(true);
	});

	it('keeps the runtime connected when demoting a user who did not activate the grant', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'other-user-demotion', token('active')));
		await service.activateCandidate('other-user-demotion', administratorId, 'homey-one');
		const previous = await dataSource.getRepository(UserEntity).findOneByOrFail({ id: otherAdministratorId });
		const next = Object.assign(new UserEntity(), previous, { role: UserRole.USER });

		await dataSource.transaction((manager) => service.prepareUpdate(previous, next, manager));
		await service.afterUpdate(previous, next);

		await expect(service.loadActiveGrantCredentials()).resolves.not.toBeNull();
		expect(runtimeRegistry.disconnectGrant).toHaveBeenCalledTimes(1);
		const shouldDisconnect = runtimeRegistry.disconnectGrant.mock.calls[0]?.[0];
		if (!shouldDisconnect) throw new Error('Homey Cloud runtime teardown guard was not registered');
		await expect(shouldDisconnect()).resolves.toBe(false);
	});

	it('retries transient post-commit runtime teardown failures', async () => {
		jest.useFakeTimers();
		let observeRetry = (): void => undefined;
		const retryObserved = new Promise<void>((resolve) => {
			observeRetry = resolve;
		});
		runtimeRegistry.disconnectGrant
			.mockRejectedValueOnce(new Error('temporary stop failure'))
			.mockImplementationOnce(() => {
				observeRetry();
				return Promise.resolve();
			});
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'retry-demotion', token('active')));
		await service.activateCandidate('retry-demotion', administratorId, 'homey-one');
		const previous = await dataSource.getRepository(UserEntity).findOneByOrFail({ id: administratorId });
		const next = Object.assign(new UserEntity(), previous, { role: UserRole.USER });

		try {
			await dataSource.transaction((manager) => service.prepareUpdate(previous, next, manager));
			await service.afterUpdate(previous, next);
			expect(runtimeRegistry.disconnectGrant).toHaveBeenCalledTimes(1);

			await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_RUNTIME_TEARDOWN_RETRY_INITIAL_MS);
			await retryObserved;

			expect(runtimeRegistry.disconnectGrant).toHaveBeenCalledTimes(2);
		} finally {
			service.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('reconciles a missing grant with runtime teardown at application bootstrap', async () => {
		let observeTeardown = (): void => undefined;
		const teardownObserved = new Promise<void>((resolve) => {
			observeTeardown = resolve;
		});
		runtimeRegistry.disconnectGrant.mockImplementation(() => {
			observeTeardown();
			return Promise.resolve();
		});

		await service.onApplicationBootstrap();
		await teardownObserved;

		expect(runtimeRegistry.disconnectGrant).toHaveBeenCalledTimes(1);
	});

	it('clears every persisted credential and authority record during factory reset', async () => {
		const context = await service.getAuthorizationContext(administratorId);
		await service.stageCandidate(candidateInput(context, 'factory-active', token('active')));
		const active = await service.activateCandidate('factory-active', administratorId, 'homey-one');
		const pendingContext = await service.getAuthorizationContext(otherAdministratorId);
		await service.stageCandidate(candidateInput(pendingContext, 'factory-pending', token('pending')));

		await service.resetForFactory();

		await expect(dataSource.getRepository(HomeyCloudPendingGrantEntity).count()).resolves.toBe(0);
		await expect(dataSource.getRepository(HomeyCloudActiveGrantEntity).count()).resolves.toBe(0);
		await expect(dataSource.getRepository(HomeyCloudUserAuthorityEntity).count()).resolves.toBe(0);
		await expect(
			dataSource.getRepository(HomeyCloudAuthorizationStateEntity).findOneByOrFail({
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
			}),
		).resolves.toMatchObject({
			activeGrantGeneration: active.generation + 1,
			configurationGeneration: active.configurationGeneration + 1,
			configurationFingerprint,
		});
	});

	function candidateInput(
		context: Awaited<ReturnType<HomeyCloudGrantMutationService['getAuthorizationContext']>>,
		transactionId: string,
		material: HomeyCloudTokenMaterial,
	) {
		return {
			...context,
			transactionId,
			redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			token: material,
		};
	}

	function token(suffix: string): HomeyCloudTokenMaterial {
		return {
			tokenType: 'bearer',
			accessToken: `access-${suffix}`,
			refreshToken: `refresh-${suffix}`,
			expiresIn: 3600,
			grantType: 'authorization_code',
			issuedAt: 1_777_777_777_000,
		};
	}

	async function createUser(id: string, username: string): Promise<void> {
		await dataSource.getRepository(UserEntity).save({
			id,
			username,
			role: UserRole.ADMIN,
			isHidden: false,
			password: null,
			email: null,
			firstName: null,
			lastName: null,
			language: null,
		});
	}

	function findPendingWithCredentials(transactionId: string): Promise<HomeyCloudPendingGrantEntity> {
		return dataSource
			.getRepository(HomeyCloudPendingGrantEntity)
			.createQueryBuilder('candidate')
			.addSelect(['candidate.accessToken', 'candidate.refreshToken'])
			.where('candidate.transactionId = :transactionId', { transactionId })
			.getOneOrFail();
	}

	function findActiveWithCredentials(): Promise<HomeyCloudActiveGrantEntity> {
		return dataSource
			.getRepository(HomeyCloudActiveGrantEntity)
			.createQueryBuilder('grant')
			.addSelect(['grant.accessToken', 'grant.refreshToken'])
			.where('grant.key = :key', { key: HOMEY_CLOUD_ACTIVE_GRANT_KEY })
			.getOneOrFail();
	}
});
