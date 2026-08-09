import { randomUUID } from 'node:crypto';
import type { Adapter, AdapterConstructor, AdapterPayload } from 'oidc-provider';
import { DataSource, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import {
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';

export interface McpOAuthProviderAdapterOptions {
	allowTestInMemory?: boolean;
	artifactReuseError?: () => Error;
	beforeArtifactUpsert?: (context: { model: string; refreshFamilyId: string | null }) => Promise<void>;
}

const isInMemoryDataSource = (dataSource: DataSource): boolean =>
	'database' in dataSource.options && dataSource.options.database === ':memory:';

const HASH_ONLY_BEARER_MODELS = new Set(['AuthorizationCode', 'AccessToken', 'RefreshToken']);

const serializePayload = (model: string, payload: AdapterPayload): string => {
	if (!HASH_ONLY_BEARER_MODELS.has(model)) return JSON.stringify(payload);

	const safePayload = { ...payload };
	delete safePayload.jti;

	return JSON.stringify(safePayload);
};

const readPayload = (record: McpOAuthProviderArtifactEntity, presentedId?: string): AdapterPayload => ({
	...(JSON.parse(record.payload) as AdapterPayload),
	...(presentedId === undefined ? {} : { jti: presentedId }),
	...(record.consumedAt === null ? {} : { consumed: record.consumedAt }),
});

export const createMcpOAuthProviderAdapter = (
	dataSource: DataSource,
	clientsService: McpOAuthClientService,
	options: McpOAuthProviderAdapterOptions = {},
): AdapterConstructor => {
	if (isInMemoryDataSource(dataSource) && (process.env.NODE_ENV !== 'test' || options.allowTestInMemory !== true)) {
		throw new Error('The MCP OAuth provider adapter permits in-memory persistence only in explicit test setups');
	}

	let consumeQueue: Promise<void> = Promise.resolve();

	return class McpOAuthTypeOrmAdapter implements Adapter {
		constructor(private readonly model: string) {}

		async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
			if (this.model === 'Client') {
				throw new Error('MCP OAuth clients may be created only through the owner/admin pre-registration API');
			}

			const grantIdHash = typeof payload.grantId === 'string' ? hashToken(payload.grantId) : null;

			if (grantIdHash !== null && (await this.isGrantRevoked(grantIdHash))) {
				throw this.artifactReuseError();
			}

			const repository = dataSource.getRepository(McpOAuthProviderArtifactEntity);
			const idHash = hashToken(id);
			const existing = await repository.findOneBy({ model: this.model, idHash });
			const refreshFamilyId = await this.resolveRefreshFamilyId(repository, existing, grantIdHash);

			if (refreshFamilyId !== null && (await this.isRefreshFamilyRevoked(refreshFamilyId))) {
				throw this.artifactReuseError();
			}

			await options.beforeArtifactUpsert?.({ model: this.model, refreshFamilyId });
			await repository.upsert(
				{
					model: this.model,
					idHash,
					managementId: existing?.managementId ?? randomUUID(),
					payload: serializePayload(this.model, payload),
					grantIdHash,
					refreshFamilyId,
					userCodeHash: typeof payload.userCode === 'string' ? hashToken(payload.userCode) : null,
					uidHash: typeof payload.uid === 'string' ? hashToken(payload.uid) : null,
					consumedAt: null,
					expiresAt: expiresIn === undefined ? null : Date.now() + expiresIn * 1_000,
				},
				['model', 'idHash'],
			);

			if (this.model === 'RefreshToken' && grantIdHash && refreshFamilyId) {
				await repository.update({ model: 'AccessToken', grantIdHash, refreshFamilyId: IsNull() }, { refreshFamilyId });
			}

			const [grantRevoked, refreshFamilyRevoked] = await Promise.all([
				grantIdHash === null ? false : this.isGrantRevoked(grantIdHash),
				refreshFamilyId === null ? false : this.isRefreshFamilyRevoked(refreshFamilyId),
			]);

			if (grantRevoked || refreshFamilyRevoked) {
				await repository.delete(
					refreshFamilyRevoked && refreshFamilyId !== null
						? { refreshFamilyId }
						: { model: this.model, idHash: hashToken(id) },
				);
				throw this.artifactReuseError();
			}
		}

		async find(id: string): Promise<AdapterPayload | undefined> {
			if (this.model === 'Client') {
				return this.findClient(id);
			}

			await this.removeExpired();
			const record = await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.findOneBy({ model: this.model, idHash: hashToken(id) });

			return this.readActiveRecord(record, id);
		}

		async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
			await this.removeExpired();
			const record = await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.findOneBy({ model: this.model, userCodeHash: hashToken(userCode) });

			return this.readActiveRecord(record);
		}

		async findByUid(uid: string): Promise<AdapterPayload | undefined> {
			await this.removeExpired();
			const record = await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.findOneBy({ model: this.model, uidHash: hashToken(uid) });

			return this.readActiveRecord(record);
		}

		async consume(id: string): Promise<void> {
			const release = await this.acquireConsumeQueue();

			try {
				let reuseDetected = false;

				await dataSource.transaction(async (manager) => {
					const repository = manager.getRepository(McpOAuthProviderArtifactEntity);
					const idHash = hashToken(id);
					const result = await repository.update(
						{ model: this.model, idHash, consumedAt: IsNull() },
						{ consumedAt: Date.now() },
					);

					if (result.affected === 1) {
						return;
					}

					const reused = await repository.findOneBy({ model: this.model, idHash });

					if (this.model === 'RefreshToken' && reused?.grantIdHash) {
						await this.revokeGrant(reused.grantIdHash, manager);
					}
					reuseDetected = true;
				});

				if (reuseDetected) throw this.artifactReuseError();
			} finally {
				release();
			}
		}

		async destroy(id: string): Promise<void> {
			if (this.model === 'Client') return;

			await dataSource
				.getRepository(McpOAuthProviderArtifactEntity)
				.delete({ model: this.model, idHash: hashToken(id) });
		}

		async revokeByGrantId(grantId: string): Promise<void> {
			const grantIdHash = hashToken(grantId);

			if (this.model === 'RefreshToken') {
				await dataSource.transaction((manager) => this.revokeGrant(grantIdHash, manager));
				return;
			}

			await dataSource.getRepository(McpOAuthProviderArtifactEntity).delete({ model: this.model, grantIdHash });
		}

		private async findClient(clientIdentifier: string): Promise<AdapterPayload | undefined> {
			const client = await clientsService.findActiveByIdentifier(clientIdentifier);

			if (!client) return undefined;

			return {
				client_id: client.clientIdentifier,
				client_name: client.name,
				application_type: 'native',
				redirect_uris: [...client.redirectUris],
				response_types: ['code'],
				grant_types: ['authorization_code', 'refresh_token'],
				token_endpoint_auth_method: 'none',
				scope: client.maximumScopes.join(' '),
			};
		}

		private artifactReuseError(): Error {
			return options.artifactReuseError?.() ?? new Error(`OAuth artifact ${this.model} was already consumed`);
		}

		private async resolveRefreshFamilyId(
			repository: Repository<McpOAuthProviderArtifactEntity>,
			existing: McpOAuthProviderArtifactEntity | null,
			grantIdHash: string | null,
		): Promise<string | null> {
			if (existing?.refreshFamilyId) return existing.refreshFamilyId;
			if (!grantIdHash || (this.model !== 'AccessToken' && this.model !== 'RefreshToken')) return null;

			const familyArtifact = await repository.findOne({
				where: { model: 'RefreshToken', grantIdHash, refreshFamilyId: Not(IsNull()) },
			});

			return familyArtifact?.refreshFamilyId ?? (this.model === 'RefreshToken' ? randomUUID() : null);
		}

		private async readActiveRecord(
			record: McpOAuthProviderArtifactEntity | null,
			presentedId?: string,
		): Promise<AdapterPayload | undefined> {
			if (!record) return undefined;

			const [grantRevoked, refreshFamilyRevoked] = await Promise.all([
				record.grantIdHash === null ? false : this.isGrantRevoked(record.grantIdHash),
				record.refreshFamilyId === null ? false : this.isRefreshFamilyRevoked(record.refreshFamilyId),
			]);

			if (grantRevoked || refreshFamilyRevoked) {
				await dataSource
					.getRepository(McpOAuthProviderArtifactEntity)
					.delete(
						refreshFamilyRevoked && record.refreshFamilyId !== null
							? { refreshFamilyId: record.refreshFamilyId }
							: { model: record.model, idHash: record.idHash },
					);
				return undefined;
			}

			return readPayload(record, presentedId);
		}

		private async isGrantRevoked(grantIdHash: string): Promise<boolean> {
			return dataSource.getRepository(McpOAuthProviderRevokedGrantEntity).existsBy({ grantIdHash });
		}

		private async isRefreshFamilyRevoked(refreshFamilyId: string): Promise<boolean> {
			return dataSource.getRepository(McpOAuthProviderRevokedRefreshFamilyEntity).existsBy({ refreshFamilyId });
		}

		private async revokeGrant(grantIdHash: string, manager = dataSource.manager): Promise<void> {
			await manager
				.getRepository(McpOAuthProviderRevokedGrantEntity)
				.upsert({ grantIdHash, revokedAt: Date.now() }, ['grantIdHash']);
			await manager.getRepository(McpOAuthProviderArtifactEntity).delete({ grantIdHash });
		}

		private async removeExpired(): Promise<void> {
			await dataSource.getRepository(McpOAuthProviderArtifactEntity).delete({
				model: this.model,
				expiresAt: LessThanOrEqual(Date.now()),
			});
		}

		private async acquireConsumeQueue(): Promise<() => void> {
			let release: () => void;
			const previous = consumeQueue;
			consumeQueue = new Promise<void>((resolve) => {
				release = resolve;
			});
			await previous;

			return release;
		}
	};
};
