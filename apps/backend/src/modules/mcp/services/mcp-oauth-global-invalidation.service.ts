import { DataSource, EntityManager, In, IsNull } from 'typeorm';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
	McpOAuthAccessTokenEntity,
	McpOAuthAuthorizationCodeEntity,
	McpOAuthGrantEntity,
	McpOAuthInteractionEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRefreshFamilyLineageEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthRefreshTokenFamilyEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import { MCP_OAUTH_SERVER_STATE_KEY } from '../mcp.constants';

import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

export type McpOAuthGlobalGeneration =
	| 'oauthEnabledGeneration'
	| 'serverSecretVersion'
	| 'publicIdentityGeneration'
	| 'modulePolicyGeneration';

@Injectable()
export class McpOAuthGlobalInvalidationService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly subscriptions: McpSubscriptionRegistryService,
	) {}

	async invalidate(generations: McpOAuthGlobalGeneration[], commit: () => Promise<void> | void): Promise<void> {
		await this.runInvalidation(generations, commit, (advanceGeneration) =>
			this.subscriptions.closeAllOAuth(advanceGeneration),
		);
	}

	async invalidateAll(generations: McpOAuthGlobalGeneration[], commit: () => Promise<void> | void): Promise<void> {
		await this.runInvalidation(generations, commit, (advanceGeneration) =>
			this.subscriptions.closeAll(advanceGeneration),
		);
	}

	private async runInvalidation(
		generations: McpOAuthGlobalGeneration[],
		commit: () => Promise<void> | void,
		closeSubscriptions: (advanceGeneration: () => Promise<void>) => Promise<void>,
	): Promise<void> {
		let commitError: unknown;
		let commitFailed = false;

		await closeSubscriptions(async () => {
			await this.dataSource.transaction((manager) => this.advanceAndRevoke(manager, generations));

			try {
				await commit();
			} catch (error) {
				commitFailed = true;
				commitError = error;
			}
		});

		if (commitFailed) throw commitError;
	}

	private async advanceAndRevoke(manager: EntityManager, generations: McpOAuthGlobalGeneration[]): Promise<void> {
		const serverState = manager.getRepository(McpOAuthServerStateEntity);

		for (const generation of new Set(generations)) {
			const result = await serverState.increment({ key: MCP_OAUTH_SERVER_STATE_KEY }, generation, 1);

			if (result.affected !== 1) {
				throw new ServiceUnavailableException(`MCP OAuth ${generation} state is unavailable`);
			}
		}

		const grants = manager.getRepository(McpOAuthGrantEntity);
		const activeGrants = await grants.findBy({ revokedAt: IsNull() });
		const revokedAt = new Date();

		if (activeGrants.length > 0) {
			const result = await grants.update(
				{ id: In(activeGrants.map((grant) => grant.id)), revokedAt: IsNull() },
				{ revokedAt, generation: () => 'generation + 1' },
			);

			if (result.affected !== activeGrants.length) {
				throw new ServiceUnavailableException('MCP OAuth grants changed during global invalidation');
			}

			const grantHashes = activeGrants
				.map((grant) => grant.providerGrantIdHash)
				.filter((hash): hash is string => hash !== null);

			if (grantHashes.length > 0) {
				await manager.getRepository(McpOAuthProviderRevokedGrantEntity).upsert(
					grantHashes.map((grantIdHash) => ({ grantIdHash, revokedAt: revokedAt.getTime() })),
					['grantIdHash'],
				);
			}
		}

		await manager.getRepository(McpOAuthProviderArtifactEntity).deleteAll();
		await manager.getRepository(McpOAuthProviderRefreshFamilyLineageEntity).deleteAll();
		await manager.getRepository(McpOAuthAuthorizationCodeEntity).deleteAll();
		await manager.getRepository(McpOAuthAccessTokenEntity).deleteAll();
		await manager.getRepository(McpOAuthRefreshTokenFamilyEntity).deleteAll();
		await manager.getRepository(McpOAuthInteractionEntity).deleteAll();
	}
}
