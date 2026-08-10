import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { UserEntity } from '../../users/entities/users.entity';
import {
	UserLifecycleCommit,
	UserLifecycleMutationHandler,
} from '../../users/services/user-lifecycle-mutation-registry.service';
import { UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
} from '../entities/mcp-oauth.entity';

import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

const APPROVER_ROLES = [UserRole.OWNER, UserRole.ADMIN];

@Injectable()
export class McpOAuthApproverAuthorityService implements UserLifecycleMutationHandler {
	constructor(
		@InjectRepository(McpOAuthApproverAuthorityEntity)
		private readonly authorities: Repository<McpOAuthApproverAuthorityEntity>,
		private readonly dataSource: DataSource,
		private readonly subscriptions: McpSubscriptionRegistryService,
	) {}

	async getGeneration(approverId: string): Promise<number> {
		return (await this.authorities.findOneBy({ approverId }))?.generation ?? 0;
	}

	async runAuthorized<T>(approverId: string, operation: (generation: number) => Promise<T>): Promise<T> {
		return this.subscriptions.runOAuthMutation(async () => {
			const user = await this.dataSource.getRepository(UserEntity).findOneBy({ id: approverId });

			if (!user || !APPROVER_ROLES.includes(user.role)) {
				throw new ForbiddenException('The MCP OAuth grant approver is no longer authorized');
			}

			let authority = await this.authorities.findOneBy({ approverId });

			if (!authority) {
				authority = await this.authorities.save(this.authorities.create({ approverId, generation: 0 }));
			}

			return operation(authority.generation);
		});
	}

	async invalidateApprover(approverId: string): Promise<void> {
		await this.mutateApprover(approverId, () => Promise.resolve());
	}

	async update<T>(previous: UserEntity, next: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		const wasApprover = APPROVER_ROLES.includes(previous.role);
		const remainsApprover = APPROVER_ROLES.includes(next.role);

		return wasApprover && !remainsApprover ? this.mutateApprover(next.id, commit) : commit();
	}

	async remove<T>(user: UserEntity, commit: UserLifecycleCommit<T>): Promise<T> {
		return this.mutateApprover(user.id, commit);
	}

	private async mutateApprover<T>(approverId: string, commit: UserLifecycleCommit<T>): Promise<T> {
		let invalidationError: unknown;
		let committed = false;
		let result!: T;

		await this.subscriptions.closeOAuthApprover(approverId, async () => {
			try {
				await this.dataSource.transaction(async (manager) => {
					await this.advanceAndRevoke(manager, approverId);
					result = await commit(manager);
					committed = true;
				});
			} catch (error) {
				invalidationError = error;
			}
		});

		if (invalidationError) throw invalidationError;
		if (!committed) throw new ServiceUnavailableException('MCP OAuth approver invalidation did not commit');

		return result;
	}

	private async advanceAndRevoke(manager: EntityManager, approverId: string): Promise<void> {
		const authorities = manager.getRepository(McpOAuthApproverAuthorityEntity);
		const authority = await authorities.findOneBy({ approverId });

		if (authority) {
			const result = await authorities.update(
				{ approverId, generation: authority.generation },
				{ generation: () => 'generation + 1' },
			);

			if (result.affected !== 1) {
				throw new ServiceUnavailableException('MCP OAuth approver authority could not be advanced');
			}
		} else {
			await authorities.insert({ approverId, generation: 1 });
		}

		const grants = manager.getRepository(McpOAuthGrantEntity);
		const activeGrants = await grants.findBy({ approvedById: approverId, revokedAt: IsNull() });
		const revokedAt = new Date();

		if (activeGrants.length === 0) return;

		const result = await grants.update(
			{ id: In(activeGrants.map((grant) => grant.id)), revokedAt: IsNull() },
			{ revokedAt, generation: () => 'generation + 1' },
		);

		if (result.affected !== activeGrants.length) {
			throw new ServiceUnavailableException('MCP OAuth approver grants could not be revoked');
		}

		const grantHashes = activeGrants
			.map((grant) => grant.providerGrantIdHash)
			.filter((hash): hash is string => hash !== null);

		if (grantHashes.length === 0) return;

		await manager.getRepository(McpOAuthProviderRevokedGrantEntity).upsert(
			grantHashes.map((grantIdHash) => ({ grantIdHash, revokedAt: revokedAt.getTime() })),
			['grantIdHash'],
		);
		const artifacts = manager.getRepository(McpOAuthProviderArtifactEntity);
		await artifacts.delete({ grantIdHash: In(grantHashes) });
		await artifacts.delete({ model: 'Grant', idHash: In(grantHashes) });
	}
}
