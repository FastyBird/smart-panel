import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, LessThanOrEqual } from 'typeorm';

import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { UserEntity } from '../../../modules/users/entities/users.entity';
import { UserLifecycleMutationParticipant } from '../../../modules/users/services/user-lifecycle-mutation-registry.service';
import { UserRole } from '../../../modules/users/users.constants';
import {
	HOMEY_CLOUD_ACTIVE_GRANT_KEY,
	HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
	HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS,
	HOMEY_CLOUD_PENDING_GRANT_CLEANUP_INTERVAL_MS,
	HOMEY_CLOUD_PENDING_GRANT_TTL_MS,
} from '../devices-homey.constants';
import {
	HomeyCloudActiveGrantEntity,
	HomeyCloudAuthorizationStateEntity,
	HomeyCloudPendingGrantEntity,
	HomeyCloudUserAuthorityEntity,
} from '../entities/homey-cloud-grant.entity';
import { HomeyCloudAuthorizationCapacityError } from '../errors/homey-cloud-authorization.error';
import {
	HomeyCloudGrantAuthorityError,
	HomeyCloudGrantConflictError,
	HomeyCloudGrantStateError,
} from '../errors/homey-cloud-grant.error';

const AUTHORIZED_ROLES = [UserRole.OWNER, UserRole.ADMIN];

export interface HomeyCloudTokenMaterial {
	readonly accessToken: string;
	readonly expiresIn: number | null;
	readonly grantType: string | null;
	readonly issuedAt: number;
	readonly refreshToken: string | null;
	readonly tokenType: string;
}

export interface HomeyCloudAuthorizationContext {
	readonly activeGrantGeneration: number;
	readonly authorityGeneration: number;
	readonly configurationGeneration: number;
	readonly initiatingUserId: string;
}

export interface HomeyCloudCandidateInput extends HomeyCloudAuthorizationContext {
	readonly expiresAt?: number;
	readonly redirectUrl: string;
	readonly token: HomeyCloudTokenMaterial;
	readonly transactionId: string;
}

export interface HomeyCloudCandidateCredentials extends HomeyCloudCandidateInput {
	readonly expiresAt: number;
}

export interface HomeyCloudActiveGrantReference {
	readonly activatedById: string;
	readonly authorityGeneration: number;
	readonly configurationGeneration: number;
	readonly generation: number;
	readonly grantIdentifier: string;
	readonly selectedHomeyId: string;
}

export interface HomeyCloudActiveGrantCredentials extends HomeyCloudActiveGrantReference {
	readonly token: HomeyCloudTokenMaterial;
}

export interface HomeyCloudRefreshInput {
	readonly configurationGeneration: number;
	readonly generation: number;
	readonly grantIdentifier: string;
	readonly token: HomeyCloudTokenMaterial;
}

export type HomeyCloudMutationCommit<T> = (manager: EntityManager) => Promise<T>;

type ActivationOutcome =
	| { readonly status: 'activated'; readonly grant: HomeyCloudActiveGrantReference }
	| { readonly status: 'authority' | 'conflict' };

@Injectable()
export class HomeyCloudGrantMutationService
	implements OnApplicationBootstrap, OnModuleDestroy, UserLifecycleMutationParticipant
{
	private readonly logger = new Logger(HomeyCloudGrantMutationService.name);
	private mutationTail: Promise<void> = Promise.resolve();
	private cleanupTimer: NodeJS.Timeout | null = null;

	constructor(private readonly dataSource: DataSource) {}

	onApplicationBootstrap(): void {
		this.cleanupTimer = setInterval(() => {
			void this.expireCandidates().catch(() => {
				this.logger.warn('Homey Cloud pending grant cleanup is temporarily unavailable');
			});
		}, HOMEY_CLOUD_PENDING_GRANT_CLEANUP_INTERVAL_MS);
		this.cleanupTimer.unref();
	}

	onModuleDestroy(): void {
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);
		this.cleanupTimer = null;
	}

	async getAuthorizationContext(initiatingUserId: string): Promise<HomeyCloudAuthorizationContext> {
		this.assertIdentifier(initiatingUserId);

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				await this.requireAuthorizedUser(manager, initiatingUserId);
				const state = await this.getState(manager);
				const authorityGeneration = await this.getOrCreateAuthorityGeneration(manager, initiatingUserId);

				return {
					activeGrantGeneration: state.activeGrantGeneration,
					authorityGeneration,
					configurationGeneration: state.configurationGeneration,
					initiatingUserId,
				};
			}),
		);
	}

	async stageCandidate(input: HomeyCloudCandidateInput): Promise<{ readonly expiresAt: number }> {
		this.assertCandidate(input);
		const now = Date.now();
		const maximumExpiresAt = now + HOMEY_CLOUD_PENDING_GRANT_TTL_MS;
		const expiresAt = input.expiresAt ?? maximumExpiresAt;

		if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > maximumExpiresAt) {
			throw new HomeyCloudGrantConflictError();
		}

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				await this.deleteExpiredCandidates(manager, now);
				await this.requireCurrentAuthority(manager, input.initiatingUserId, input.authorityGeneration);
				const state = await this.getState(manager);

				if (
					state.activeGrantGeneration !== input.activeGrantGeneration ||
					state.configurationGeneration !== input.configurationGeneration
				) {
					throw new HomeyCloudGrantConflictError();
				}

				const candidates = manager.getRepository(HomeyCloudPendingGrantEntity);

				if (await candidates.existsBy({ transactionId: input.transactionId })) {
					throw new HomeyCloudGrantConflictError();
				}
				if ((await candidates.count()) >= HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS) {
					throw new HomeyCloudAuthorizationCapacityError();
				}

				await candidates.insert({
					transactionId: input.transactionId,
					initiatingUserId: input.initiatingUserId,
					authorityGeneration: input.authorityGeneration,
					activeGrantGeneration: input.activeGrantGeneration,
					configurationGeneration: input.configurationGeneration,
					redirectUrl: input.redirectUrl,
					tokenType: input.token.tokenType,
					accessToken: input.token.accessToken,
					refreshToken: input.token.refreshToken,
					expiresIn: input.token.expiresIn,
					grantType: input.token.grantType,
					tokenIssuedAt: input.token.issuedAt,
					expiresAt,
				});

				return { expiresAt };
			}),
		);
	}

	async loadCandidateCredentials(
		transactionId: string,
		initiatingUserId: string,
	): Promise<HomeyCloudCandidateCredentials> {
		this.assertIdentifier(transactionId);
		this.assertIdentifier(initiatingUserId);

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				const now = Date.now();
				await this.deleteExpiredCandidates(manager, now);
				const candidate = await this.findCandidateWithCredentials(manager, transactionId, initiatingUserId);

				if (!candidate || candidate.expiresAt <= now) throw new HomeyCloudGrantConflictError();

				return this.toCandidateCredentials(candidate);
			}),
		);
	}

	async cancelCandidate(transactionId: string, initiatingUserId: string): Promise<boolean> {
		this.assertIdentifier(transactionId);
		this.assertIdentifier(initiatingUserId);

		return this.runMutation(async () => {
			const result = await this.dataSource.getRepository(HomeyCloudPendingGrantEntity).delete({
				transactionId,
				initiatingUserId,
			});

			return result.affected === 1;
		});
	}

	async expireCandidates(now = Date.now()): Promise<number> {
		if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Homey Cloud cleanup time is invalid');

		return this.runMutation(() => this.dataSource.transaction((manager) => this.deleteExpiredCandidates(manager, now)));
	}

	async activateCandidate(
		transactionId: string,
		initiatingUserId: string,
		selectedHomeyId: string,
	): Promise<HomeyCloudActiveGrantReference> {
		this.assertIdentifier(transactionId);
		this.assertIdentifier(initiatingUserId);
		this.assertIdentifier(selectedHomeyId);

		const outcome = await this.runMutation(() =>
			this.dataSource.transaction((manager) =>
				this.activateCandidateInternal(manager, transactionId, initiatingUserId, selectedHomeyId),
			),
		);

		if (outcome.status !== 'activated') {
			if (outcome.status === 'authority') throw new HomeyCloudGrantAuthorityError();
			throw new HomeyCloudGrantConflictError();
		}

		return outcome.grant;
	}

	async loadActiveGrantCredentials(): Promise<HomeyCloudActiveGrantCredentials | null> {
		return this.runMutation(async () => {
			const active = await this.findActiveGrantWithCredentials(this.dataSource.manager);

			return active ? this.toActiveCredentials(active) : null;
		});
	}

	async persistRefresh(input: HomeyCloudRefreshInput): Promise<HomeyCloudActiveGrantReference | null> {
		this.assertIdentifier(input.grantIdentifier);
		this.assertGeneration(input.generation);
		this.assertGeneration(input.configurationGeneration);
		this.assertToken(input.token);

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				const state = await this.getState(manager);

				if (
					state.activeGrantGeneration !== input.generation ||
					state.configurationGeneration !== input.configurationGeneration
				) {
					return null;
				}

				const activeGrants = manager.getRepository(HomeyCloudActiveGrantEntity);
				const active = await activeGrants.findOneBy({
					key: HOMEY_CLOUD_ACTIVE_GRANT_KEY,
					grantIdentifier: input.grantIdentifier,
					generation: input.generation,
					configurationGeneration: input.configurationGeneration,
				});

				if (!active) return null;

				const nextGeneration = input.generation + 1;
				const stateResult = await manager.getRepository(HomeyCloudAuthorizationStateEntity).update(
					{
						key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
						activeGrantGeneration: input.generation,
						configurationGeneration: input.configurationGeneration,
					},
					{ activeGrantGeneration: nextGeneration },
				);

				if (stateResult.affected !== 1) return null;

				const grantResult = await activeGrants.update(
					{
						key: HOMEY_CLOUD_ACTIVE_GRANT_KEY,
						grantIdentifier: input.grantIdentifier,
						generation: input.generation,
					},
					{
						generation: nextGeneration,
						tokenType: input.token.tokenType,
						accessToken: input.token.accessToken,
						refreshToken: input.token.refreshToken,
						expiresIn: input.token.expiresIn,
						grantType: input.token.grantType,
						tokenIssuedAt: input.token.issuedAt,
						updatedAt: new Date(),
					},
				);

				if (grantResult.affected !== 1) throw new HomeyCloudGrantStateError();

				return this.toActiveReference({ ...active, generation: nextGeneration });
			}),
		);
	}

	async disconnect(actingUserId: string): Promise<boolean> {
		this.assertIdentifier(actingUserId);

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				await this.requireAuthorizedUser(manager, actingUserId);
				const state = await this.getState(manager);
				const result = await manager
					.getRepository(HomeyCloudActiveGrantEntity)
					.delete({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY });

				await manager.getRepository(HomeyCloudPendingGrantEntity).clear();
				await this.advanceState(manager, state, {
					activeGrantGeneration: state.activeGrantGeneration + 1,
				});

				return result.affected === 1;
			}),
		);
	}

	async invalidateConfiguration<T>(commit: HomeyCloudMutationCommit<T>): Promise<T> {
		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				const state = await this.getState(manager);

				await manager.getRepository(HomeyCloudPendingGrantEntity).clear();
				await manager.getRepository(HomeyCloudActiveGrantEntity).clear();
				await this.advanceState(manager, state, {
					activeGrantGeneration: state.activeGrantGeneration + 1,
					configurationGeneration: state.configurationGeneration + 1,
				});

				return commit(manager);
			}),
		);
	}

	async invalidateUserAuthority<T>(userId: string, commit: HomeyCloudMutationCommit<T>): Promise<T> {
		this.assertIdentifier(userId);

		return this.runMutation(() =>
			this.dataSource.transaction(async (manager) => {
				await this.invalidateUserAuthorityInternal(manager, userId);
				return commit(manager);
			}),
		);
	}

	async prepareUpdate(previous: UserEntity, next: UserEntity, manager: EntityManager): Promise<void> {
		const wasAuthorized = AUTHORIZED_ROLES.includes(previous.role);
		const remainsAuthorized = AUTHORIZED_ROLES.includes(next.role);

		if (wasAuthorized && !remainsAuthorized) {
			await this.runMutation(() => this.invalidateUserAuthorityInternal(manager, next.id));
		}
	}

	async prepareRemove(user: UserEntity, manager: EntityManager): Promise<void> {
		await this.runMutation(() => this.invalidateUserAuthorityInternal(manager, user.id));
	}

	private async activateCandidateInternal(
		manager: EntityManager,
		transactionId: string,
		initiatingUserId: string,
		selectedHomeyId: string,
	): Promise<ActivationOutcome> {
		const now = Date.now();
		await this.deleteExpiredCandidates(manager, now);
		const candidate = await this.findCandidateWithCredentials(manager, transactionId, initiatingUserId);

		if (!candidate) return { status: 'conflict' };

		const user = await manager.getRepository(UserEntity).findOneBy({ id: initiatingUserId });
		const authority = await manager.getRepository(HomeyCloudUserAuthorityEntity).findOneBy({
			userId: initiatingUserId,
		});
		const authorityGeneration = authority?.generation ?? 0;
		const state = await this.getState(manager);
		const authorized = user !== null && AUTHORIZED_ROLES.includes(user.role);
		const authorityCurrent = authorityGeneration === candidate.authorityGeneration;
		const generationsCurrent =
			state.activeGrantGeneration === candidate.activeGrantGeneration &&
			state.configurationGeneration === candidate.configurationGeneration;

		if (!authorized || !authorityCurrent || !generationsCurrent || candidate.expiresAt <= now) {
			await manager.getRepository(HomeyCloudPendingGrantEntity).delete({ transactionId, initiatingUserId });

			return { status: !authorized || !authorityCurrent ? 'authority' : 'conflict' };
		}

		const nextGeneration = state.activeGrantGeneration + 1;
		const grantIdentifier = randomUUID();
		const activeGrant = manager.getRepository(HomeyCloudActiveGrantEntity).create({
			key: HOMEY_CLOUD_ACTIVE_GRANT_KEY,
			grantIdentifier,
			activatedById: initiatingUserId,
			authorityGeneration,
			generation: nextGeneration,
			configurationGeneration: state.configurationGeneration,
			selectedHomeyId,
			tokenType: candidate.tokenType,
			accessToken: candidate.accessToken,
			refreshToken: candidate.refreshToken,
			expiresIn: candidate.expiresIn,
			grantType: candidate.grantType,
			tokenIssuedAt: candidate.tokenIssuedAt,
			activatedAt: new Date(),
			updatedAt: null,
		});

		await manager.getRepository(HomeyCloudActiveGrantEntity).save(activeGrant);
		const consumed = await manager.getRepository(HomeyCloudPendingGrantEntity).delete({
			transactionId,
			initiatingUserId,
		});

		if (consumed.affected !== 1) throw new HomeyCloudGrantStateError();

		await this.advanceState(manager, state, { activeGrantGeneration: nextGeneration });

		return { status: 'activated', grant: this.toActiveReference(activeGrant) };
	}

	private async getState(manager: EntityManager): Promise<HomeyCloudAuthorizationStateEntity> {
		const states = manager.getRepository(HomeyCloudAuthorizationStateEntity);
		let state = await states.findOneBy({ key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY });

		if (!state) {
			await states.insert({
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
				activeGrantGeneration: 0,
				configurationGeneration: 0,
			});
			state = await states.findOneBy({ key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY });
		}

		if (!state) throw new HomeyCloudGrantStateError();

		return state;
	}

	private async advanceState(
		manager: EntityManager,
		state: HomeyCloudAuthorizationStateEntity,
		update: Partial<Pick<HomeyCloudAuthorizationStateEntity, 'activeGrantGeneration' | 'configurationGeneration'>>,
	): Promise<void> {
		const result = await manager.getRepository(HomeyCloudAuthorizationStateEntity).update(
			{
				key: HOMEY_CLOUD_AUTHORIZATION_STATE_KEY,
				activeGrantGeneration: state.activeGrantGeneration,
				configurationGeneration: state.configurationGeneration,
			},
			update,
		);

		if (result.affected !== 1) throw new HomeyCloudGrantStateError();
	}

	private async requireCurrentAuthority(
		manager: EntityManager,
		userId: string,
		expectedGeneration: number,
	): Promise<void> {
		await this.requireAuthorizedUser(manager, userId);
		const actualGeneration = await this.getOrCreateAuthorityGeneration(manager, userId);

		if (actualGeneration !== expectedGeneration) throw new HomeyCloudGrantAuthorityError();
	}

	private async requireAuthorizedUser(manager: EntityManager, userId: string): Promise<UserEntity> {
		const user = await manager.getRepository(UserEntity).findOneBy({ id: userId });

		if (!user || !AUTHORIZED_ROLES.includes(user.role)) throw new HomeyCloudGrantAuthorityError();

		return user;
	}

	private async getOrCreateAuthorityGeneration(manager: EntityManager, userId: string): Promise<number> {
		const authorities = manager.getRepository(HomeyCloudUserAuthorityEntity);
		let authority = await authorities.findOneBy({ userId });

		if (!authority) {
			await authorities.insert({ userId, generation: 0 });
			authority = await authorities.findOneBy({ userId });
		}

		if (!authority) throw new HomeyCloudGrantStateError();

		return authority.generation;
	}

	private async advanceAuthority(manager: EntityManager, userId: string): Promise<void> {
		const authorities = manager.getRepository(HomeyCloudUserAuthorityEntity);
		const authority = await authorities.findOneBy({ userId });

		if (!authority) {
			await authorities.insert({ userId, generation: 1 });
			return;
		}

		const result = await authorities.update(
			{ userId, generation: authority.generation },
			{ generation: authority.generation + 1 },
		);

		if (result.affected !== 1) throw new HomeyCloudGrantStateError();
	}

	private async invalidateUserAuthorityInternal(manager: EntityManager, userId: string): Promise<void> {
		await this.advanceAuthority(manager, userId);
		await manager.getRepository(HomeyCloudPendingGrantEntity).delete({ initiatingUserId: userId });

		const activeGrants = manager.getRepository(HomeyCloudActiveGrantEntity);
		const active = await activeGrants.findOneBy({
			key: HOMEY_CLOUD_ACTIVE_GRANT_KEY,
			activatedById: userId,
		});

		if (!active) return;

		const state = await this.getState(manager);
		await activeGrants.delete({ key: HOMEY_CLOUD_ACTIVE_GRANT_KEY });
		await this.advanceState(manager, state, {
			activeGrantGeneration: state.activeGrantGeneration + 1,
		});
	}

	private async deleteExpiredCandidates(manager: EntityManager, now: number): Promise<number> {
		const result = await manager.getRepository(HomeyCloudPendingGrantEntity).delete({
			expiresAt: LessThanOrEqual(now),
		});

		return result.affected ?? 0;
	}

	private findCandidateWithCredentials(
		manager: EntityManager,
		transactionId: string,
		initiatingUserId: string,
	): Promise<HomeyCloudPendingGrantEntity | null> {
		return manager
			.getRepository(HomeyCloudPendingGrantEntity)
			.createQueryBuilder('candidate')
			.addSelect([
				'candidate.tokenType',
				'candidate.accessToken',
				'candidate.refreshToken',
				'candidate.expiresIn',
				'candidate.grantType',
				'candidate.tokenIssuedAt',
			])
			.where('candidate.transactionId = :transactionId', { transactionId })
			.andWhere('candidate.initiatingUserId = :initiatingUserId', { initiatingUserId })
			.getOne();
	}

	private findActiveGrantWithCredentials(manager: EntityManager): Promise<HomeyCloudActiveGrantEntity | null> {
		return manager
			.getRepository(HomeyCloudActiveGrantEntity)
			.createQueryBuilder('grant')
			.addSelect([
				'grant.tokenType',
				'grant.accessToken',
				'grant.refreshToken',
				'grant.expiresIn',
				'grant.grantType',
				'grant.tokenIssuedAt',
			])
			.where('grant.key = :key', { key: HOMEY_CLOUD_ACTIVE_GRANT_KEY })
			.getOne();
	}

	private toCandidateCredentials(candidate: HomeyCloudPendingGrantEntity): HomeyCloudCandidateCredentials {
		return {
			transactionId: candidate.transactionId,
			initiatingUserId: candidate.initiatingUserId,
			authorityGeneration: candidate.authorityGeneration,
			activeGrantGeneration: candidate.activeGrantGeneration,
			configurationGeneration: candidate.configurationGeneration,
			redirectUrl: candidate.redirectUrl,
			expiresAt: candidate.expiresAt,
			token: this.toTokenMaterial(candidate),
		};
	}

	private toActiveCredentials(active: HomeyCloudActiveGrantEntity): HomeyCloudActiveGrantCredentials {
		return { ...this.toActiveReference(active), token: this.toTokenMaterial(active) };
	}

	private toActiveReference(active: HomeyCloudActiveGrantEntity): HomeyCloudActiveGrantReference {
		return {
			grantIdentifier: active.grantIdentifier,
			activatedById: active.activatedById,
			authorityGeneration: active.authorityGeneration,
			generation: active.generation,
			configurationGeneration: active.configurationGeneration,
			selectedHomeyId: active.selectedHomeyId,
		};
	}

	private toTokenMaterial(grant: HomeyCloudPendingGrantEntity | HomeyCloudActiveGrantEntity): HomeyCloudTokenMaterial {
		return {
			tokenType: grant.tokenType,
			accessToken: grant.accessToken,
			refreshToken: grant.refreshToken,
			expiresIn: grant.expiresIn,
			grantType: grant.grantType,
			issuedAt: grant.tokenIssuedAt,
		};
	}

	private assertCandidate(input: HomeyCloudCandidateInput): void {
		this.assertIdentifier(input.transactionId);
		this.assertIdentifier(input.initiatingUserId);
		this.assertIdentifier(input.redirectUrl);
		this.assertGeneration(input.authorityGeneration);
		this.assertGeneration(input.activeGrantGeneration);
		this.assertGeneration(input.configurationGeneration);
		this.assertToken(input.token);
	}

	private assertToken(token: HomeyCloudTokenMaterial): void {
		this.assertIdentifier(token.tokenType);
		this.assertIdentifier(token.accessToken);

		if (token.refreshToken !== null) this.assertIdentifier(token.refreshToken);
		if (token.grantType !== null) this.assertIdentifier(token.grantType);
		if (token.expiresIn !== null && (!Number.isSafeInteger(token.expiresIn) || token.expiresIn < 0)) {
			throw new TypeError('Homey Cloud token material is invalid');
		}
		if (!Number.isSafeInteger(token.issuedAt) || token.issuedAt < 0) {
			throw new TypeError('Homey Cloud token material is invalid');
		}
	}

	private assertIdentifier(value: string): void {
		if (typeof value !== 'string' || value.trim().length === 0) {
			throw new TypeError('Homey Cloud authorization identifier is invalid');
		}
	}

	private assertGeneration(value: number): void {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new TypeError('Homey Cloud authorization generation is invalid');
		}
	}

	private async runMutation<T>(operation: () => Promise<T>): Promise<T> {
		const previousMutation = this.mutationTail;
		let releaseMutation = (): void => undefined;
		this.mutationTail = new Promise<void>((resolve) => {
			releaseMutation = resolve;
		});

		await previousMutation;

		try {
			return await operation();
		} finally {
			releaseMutation();
		}
	}
}
