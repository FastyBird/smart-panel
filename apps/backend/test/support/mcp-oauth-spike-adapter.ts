import type { Adapter, AdapterConstructor, AdapterPayload } from 'oidc-provider';
import { DataSource, EntitySchema, IsNull, LessThanOrEqual, Repository } from 'typeorm';

interface McpOAuthSpikeArtifact {
	model: string;
	id: string;
	payload: string;
	grantId: string | null;
	userCode: string | null;
	uid: string | null;
	consumedAt: number | null;
	expiresAt: number | null;
}

interface McpOAuthSpikeRevokedGrant {
	grantId: string;
	revokedAt: number;
}

export const McpOAuthSpikeArtifactSchema = new EntitySchema<McpOAuthSpikeArtifact>({
	name: 'McpOAuthSpikeArtifact',
	tableName: 'mcp_oauth_spike_artifacts',
	columns: {
		model: { type: String, primary: true },
		id: { type: String, primary: true },
		payload: { type: 'text' },
		grantId: { type: String, nullable: true },
		userCode: { type: String, nullable: true },
		uid: { type: String, nullable: true },
		consumedAt: { type: Number, nullable: true },
		expiresAt: { type: Number, nullable: true },
	},
	indices: [{ columns: ['grantId'] }, { columns: ['userCode'] }, { columns: ['uid'] }, { columns: ['expiresAt'] }],
});

export const McpOAuthSpikeRevokedGrantSchema = new EntitySchema<McpOAuthSpikeRevokedGrant>({
	name: 'McpOAuthSpikeRevokedGrant',
	tableName: 'mcp_oauth_spike_revoked_grants',
	columns: {
		grantId: { type: String, primary: true },
		revokedAt: { type: Number },
	},
});

export interface McpOAuthSpikeAdapterOptions {
	allowTestInMemory?: boolean;
	artifactReuseError?: () => Error;
}

const isInMemoryDataSource = (dataSource: DataSource): boolean =>
	'database' in dataSource.options && dataSource.options.database === ':memory:';

const readPayload = (record: McpOAuthSpikeArtifact): AdapterPayload => ({
	...(JSON.parse(record.payload) as AdapterPayload),
	...(record.consumedAt === null ? {} : { consumed: record.consumedAt }),
});

export const createMcpOAuthSpikeAdapter = (
	dataSource: DataSource,
	options: McpOAuthSpikeAdapterOptions = {},
): AdapterConstructor => {
	if (isInMemoryDataSource(dataSource) && (process.env.NODE_ENV !== 'test' || options.allowTestInMemory !== true)) {
		throw new Error('The MCP OAuth TypeORM adapter permits in-memory persistence only in explicit test setups');
	}

	return class McpOAuthSpikeTypeOrmAdapter implements Adapter {
		private readonly repository: Repository<McpOAuthSpikeArtifact>;
		private readonly revokedGrantRepository: Repository<McpOAuthSpikeRevokedGrant>;

		constructor(private readonly model: string) {
			this.repository = dataSource.getRepository(McpOAuthSpikeArtifactSchema);
			this.revokedGrantRepository = dataSource.getRepository(McpOAuthSpikeRevokedGrantSchema);
		}

		async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
			const expiresAt = expiresIn === undefined ? null : Date.now() + expiresIn * 1_000;
			const grantId = typeof payload.grantId === 'string' ? payload.grantId : null;

			if (grantId !== null && (await this.isGrantRevoked(grantId))) {
				throw this.artifactReuseError();
			}

			await this.repository.upsert(
				{
					model: this.model,
					id,
					payload: JSON.stringify(payload),
					grantId,
					userCode: typeof payload.userCode === 'string' ? payload.userCode : null,
					uid: typeof payload.uid === 'string' ? payload.uid : null,
					consumedAt: null,
					expiresAt,
				},
				['model', 'id'],
			);

			if (grantId !== null && (await this.isGrantRevoked(grantId))) {
				await this.repository.delete({ model: this.model, id });
				throw this.artifactReuseError();
			}
		}

		async find(id: string): Promise<AdapterPayload | undefined> {
			await this.removeExpired();

			const record = await this.repository.findOneBy({ model: this.model, id });

			return this.readActiveRecord(record);
		}

		async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
			await this.removeExpired();

			const record = await this.repository.findOneBy({ model: this.model, userCode });

			return this.readActiveRecord(record);
		}

		async findByUid(uid: string): Promise<AdapterPayload | undefined> {
			await this.removeExpired();

			const record = await this.repository.findOneBy({ model: this.model, uid });

			return this.readActiveRecord(record);
		}

		async consume(id: string): Promise<void> {
			const result = await this.repository.update(
				{ model: this.model, id, consumedAt: IsNull() },
				{ consumedAt: Date.now() },
			);

			if (result.affected !== 1) {
				const reusedArtifact = await this.repository.findOneBy({ model: this.model, id });

				if (this.model === 'RefreshToken' && typeof reusedArtifact?.grantId === 'string') {
					await this.revokeGrant(reusedArtifact.grantId);
				}

				throw this.artifactReuseError();
			}
		}

		async destroy(id: string): Promise<void> {
			await this.repository.delete({ model: this.model, id });
		}

		async revokeByGrantId(grantId: string): Promise<void> {
			if (this.model === 'RefreshToken') {
				await this.revokeGrant(grantId);
				return;
			}

			await this.repository.delete({ model: this.model, grantId });
		}

		private artifactReuseError(): Error {
			return (
				options.artifactReuseError?.() ??
				new Error(`OAuth artifact ${this.model} was already consumed or belongs to a revoked grant`)
			);
		}

		private async isGrantRevoked(grantId: string): Promise<boolean> {
			return this.revokedGrantRepository.existsBy({ grantId });
		}

		private async readActiveRecord(record: McpOAuthSpikeArtifact | null): Promise<AdapterPayload | undefined> {
			if (record === null) {
				return undefined;
			}

			if (record.grantId !== null && (await this.isGrantRevoked(record.grantId))) {
				await this.repository.delete({ model: record.model, id: record.id });
				return undefined;
			}

			return readPayload(record);
		}

		private async revokeGrant(grantId: string): Promise<void> {
			await this.revokedGrantRepository.upsert({ grantId, revokedAt: Date.now() }, ['grantId']);
			await this.repository.delete({ grantId });
		}

		private async removeExpired(): Promise<void> {
			await this.repository.delete({
				model: this.model,
				expiresAt: LessThanOrEqual(Date.now()),
			});
		}
	};
};
