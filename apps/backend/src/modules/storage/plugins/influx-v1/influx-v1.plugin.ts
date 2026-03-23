import { FieldType, IPingStats, IPoint, IQueryOptions, IResults, ISchemaOptions, InfluxDB } from 'influx';

import { createExtensionLogger } from '../../../../common/logger';
import { safeNumber, safeToString } from '../../../../common/utils/transform.utils';
import { StoragePlugin } from '../../interfaces/storage-plugin.interface';
import { INFLUXDB_DEFAULT_DATABASE, INFLUXDB_DEFAULT_HOST } from '../../storage.constants';
import { StorageFieldType, StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../../storage.types';

import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';

type RetentionPolicyRow = {
	name: string;
	duration: string;
	shardGroupDuration: string;
	replicaN: number;
	default: boolean;
};

type ContinuousQueryRow = {
	name: string;
	query: string;
};

type InfluxSeries = {
	values?: unknown[][];
};

type InfluxResults = {
	results?: Array<{ series?: InfluxSeries[] }>;
};

export interface InfluxV1Config {
	host: string;
	database: string;
	username?: string;
	password?: string;
}

const isObject = (v: unknown): boolean => {
	return typeof v === 'object' && v !== null;
};

const isArrayOfRetentionPolicies = (v: unknown): boolean => {
	return (
		Array.isArray(v) && v.length > 0 && isObject(v[0]) && typeof (v[0] as Record<string, unknown>).name === 'string'
	);
};

const isArrayOfContinuousQueries = (v: unknown): boolean => {
	return (
		Array.isArray(v) && v.length > 0 && isObject(v[0]) && typeof (v[0] as Record<string, unknown>).name === 'string'
	);
};

/**
 * Map storage-agnostic field types to InfluxDB field types.
 */
function toInfluxFieldType(type: StorageFieldType): FieldType {
	switch (type) {
		case StorageFieldType.FLOAT:
			return FieldType.FLOAT;
		case StorageFieldType.INTEGER:
			return FieldType.INTEGER;
		case StorageFieldType.STRING:
			return FieldType.STRING;
		case StorageFieldType.BOOLEAN:
			return FieldType.BOOLEAN;
	}
}

/**
 * Map a StorageMeasurementSchema to an InfluxDB ISchemaOptions.
 */
function toInfluxSchema(schema: StorageMeasurementSchema): ISchemaOptions {
	const fields: Record<string, FieldType> = {};

	for (const [key, type] of Object.entries(schema.fields)) {
		fields[key] = toInfluxFieldType(type);
	}

	return {
		measurement: schema.measurement,
		fields,
		tags: schema.tags,
	};
}

/**
 * Map a StoragePoint to an InfluxDB IPoint.
 */
function toInfluxPoint(point: StoragePoint): IPoint {
	return {
		measurement: point.measurement,
		tags: point.tags,
		fields: point.fields,
		timestamp: point.timestamp,
	};
}

/**
 * Map StorageQueryOptions to InfluxDB IQueryOptions.
 */
function toInfluxQueryOptions(options?: StorageQueryOptions): IQueryOptions | undefined {
	if (!options) return undefined;

	return {
		database: options.database,
		retentionPolicy: options.retentionPolicy,
		precision: options.precision,
	};
}

/**
 * InfluxDB v1.x storage plugin.
 *
 * Connects to an InfluxDB 1.x server and provides full time-series
 * storage with retention policies, continuous queries, and all
 * native InfluxDB features.
 */
export class InfluxV1Plugin implements StoragePlugin {
	readonly name = INFLUX_V1_PLUGIN_NAME;

	private readonly logger = createExtensionLogger(INFLUX_V1_PLUGIN_NAME, 'InfluxV1Plugin');

	private connection: InfluxDB | null = null;
	private readonly schemas: ISchemaOptions[] = [];
	private config: InfluxV1Config;

	constructor(config?: Partial<InfluxV1Config>) {
		this.config = {
			host: config?.host ?? INFLUXDB_DEFAULT_HOST,
			database: config?.database ?? INFLUXDB_DEFAULT_DATABASE,
			username: config?.username,
			password: config?.password,
		};
	}

	updateConfig(config: Partial<InfluxV1Config>): void {
		if (config.host) this.config.host = config.host;
		if (config.database) this.config.database = config.database;
		if (config.username !== undefined) this.config.username = config.username;
		if (config.password !== undefined) this.config.password = config.password;
	}

	async initialize(): Promise<void> {
		this.connection = new InfluxDB({
			host: this.config.host,
			database: this.config.database,
			username: this.config.username,
			password: this.config.password,
			schema: this.schemas,
		});

		await this.setupDatabase();
	}

	destroy(): Promise<void> {
		this.connection = null;
		this.logger.log('Connection closed.');

		return Promise.resolve();
	}

	isAvailable(): boolean {
		return this.connection !== null;
	}

	// ─── Core Read/Write ──────────────────────────────────────────────

	async writePoints(points: StoragePoint[]): Promise<void> {
		return this.getConnection().writePoints(points.map(toInfluxPoint));
	}

	async query<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		try {
			const results: IResults<T> = await this.getConnection().query(query, toInfluxQueryOptions(options));

			return results as unknown as T[];
		} catch (error) {
			const err = error as Error;

			if (err.message?.includes('database not found')) {
				this.logger.warn('Database not found, returning empty results. Attempting to recreate...');
				void this.setupDatabase();

				return [];
			}

			throw error;
		}
	}

	async queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T> {
		try {
			return (await this.getConnection().queryRaw(query, toInfluxQueryOptions(options))) as T;
		} catch (error) {
			const err = error as Error;

			if (err.message?.includes('database not found')) {
				this.logger.warn('Database not found, returning empty results. Attempting to recreate...');
				void this.setupDatabase();

				return { results: [] } as T;
			}

			throw error;
		}
	}

	registerSchema(schema: StorageMeasurementSchema): void {
		this.schemas.push(toInfluxSchema(schema));
	}

	async dropMeasurement(measurement: string): Promise<void> {
		return this.getConnection().dropMeasurement(measurement);
	}

	async getMeasurements(): Promise<string[]> {
		return this.getConnection().getMeasurements();
	}

	// ─── InfluxDB-Specific Operations ─────────────────────────────────

	async createDatabase(...args: Parameters<InfluxDB['createDatabase']>): Promise<void> {
		return this.getConnection().createDatabase(...args);
	}

	async dropDatabase(...args: Parameters<InfluxDB['dropDatabase']>): Promise<void> {
		return this.getConnection().dropDatabase(...args);
	}

	async getDatabaseNames(): Promise<string[]> {
		return this.getConnection().getDatabaseNames();
	}

	async createRetentionPolicy(...args: Parameters<InfluxDB['createRetentionPolicy']>): Promise<void> {
		return this.getConnection().createRetentionPolicy(...args);
	}

	async alterRetentionPolicy(...args: Parameters<InfluxDB['alterRetentionPolicy']>): Promise<void> {
		return this.getConnection().alterRetentionPolicy(...args);
	}

	async showRetentionPolicies(...args: Parameters<InfluxDB['showRetentionPolicies']>): Promise<
		IResults<{
			default: boolean;
			duration: string;
			name: string;
			replicaN: number;
			shardGroupDuration: string;
		}>
	> {
		return this.getConnection().showRetentionPolicies(...args);
	}

	async dropRetentionPolicy(...args: Parameters<InfluxDB['dropRetentionPolicy']>): Promise<void> {
		return this.getConnection().dropRetentionPolicy(...args);
	}

	async createContinuousQuery(name: string, body: string, db?: string, resample?: string): Promise<void> {
		if (!db) {
			return this.createContinuousQuery(name, body, this.config.database, resample);
		}

		const existing = await this.listContinuousQueriesClean(db);
		const current = existing.find((cq) => cq.name === name);

		if (!current) {
			return this.getConnection().createContinuousQuery(name, body, db, resample);
		}

		const have = this.normalizeCqForCompare(current.query, db);
		const want = this.normalizeCqForCompare(body, db);

		const resampleHave = this.normalizeCqResample(current.query);
		const resampleWant = this.normalizeCqResample(resample);

		if (have === want && resampleHave === resampleWant) {
			return;
		}

		await this.getConnection().dropContinuousQuery(name, db);

		return this.getConnection().createContinuousQuery(name, body, db, resample);
	}

	async showContinuousQueries(
		...args: Parameters<InfluxDB['showContinousQueries']>
	): Promise<IResults<{ name: string; query: string }>> {
		return this.getConnection().showContinousQueries(...args);
	}

	async dropContinuousQuery(...args: Parameters<InfluxDB['dropContinuousQuery']>): Promise<void> {
		return this.getConnection().dropContinuousQuery(...args);
	}

	async dropSeries(...args: Parameters<InfluxDB['dropSeries']>): Promise<void> {
		return this.getConnection().dropSeries(...args);
	}

	async ping(): Promise<IPingStats[]> {
		return this.getConnection().ping(5_000);
	}

	async createUser(...args: Parameters<InfluxDB['createUser']>): Promise<void> {
		return this.getConnection().createUser(...args);
	}

	async dropUser(...args: Parameters<InfluxDB['dropUser']>): Promise<void> {
		return this.getConnection().dropUser(...args);
	}

	async getUsers(): Promise<Array<{ user: string; admin: boolean }>> {
		return this.getConnection().getUsers();
	}

	async setPassword(...args: Parameters<InfluxDB['setPassword']>): Promise<void> {
		return this.getConnection().setPassword(...args);
	}

	async grantPrivilege(...args: Parameters<InfluxDB['grantPrivilege']>): Promise<void> {
		return this.getConnection().grantPrivilege(...args);
	}

	async revokePrivilege(...args: Parameters<InfluxDB['revokePrivilege']>): Promise<void> {
		return this.getConnection().revokePrivilege(...args);
	}

	async grantAdminPrivilege(...args: Parameters<InfluxDB['grantAdminPrivilege']>): Promise<void> {
		return this.getConnection().grantAdminPrivilege(...args);
	}

	async revokeAdminPrivilege(...args: Parameters<InfluxDB['revokeAdminPrivilege']>): Promise<void> {
		return this.getConnection().revokeAdminPrivilege(...args);
	}

	async writeMeasurement(...args: Parameters<InfluxDB['writeMeasurement']>): Promise<void> {
		return this.getConnection().writeMeasurement(...args);
	}

	async getSeries(): Promise<string[]> {
		return this.getConnection().getSeries();
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private getConnection(): InfluxDB {
		if (!this.connection) {
			throw new Error('InfluxDB connection is not initialized');
		}

		return this.connection;
	}

	private async setupDatabase(): Promise<void> {
		const conn = this.getConnection();

		try {
			const databases = await conn.getDatabaseNames();

			if (!databases.includes(this.config.database)) {
				await conn.createDatabase(this.config.database);
				this.logger.log(`Database '${this.config.database}' created.`);
			}

			await this.ensureRetentionPolicies(this.config.database);
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to connect to InfluxDB', { message: err.message, stack: err.stack });

			this.connection = null;
		}
	}

	private async ensureRetentionPolicies(database: string): Promise<void> {
		const existing = await this.listRetentionPoliciesClean(database);

		const byName = new Map(existing.map((rp) => [rp.name, rp]));

		if (!byName.has('raw_24h')) {
			await this.createRetentionPolicy('raw_24h', { database, duration: '24h', replication: 1, isDefault: true });
		}

		if (!byName.has('min_14d')) {
			await this.createRetentionPolicy('min_14d', { database, duration: '14d', replication: 1 });
		}

		if (!byName.get('raw_24h')?.default) {
			const cur = byName.get('raw_24h');

			if (typeof cur !== 'undefined') {
				await this.alterRetentionPolicy('raw_24h', {
					database,
					duration: cur.duration,
					replication: cur.replicaN,
					isDefault: true,
				});
			}
		}
	}

	private async listRetentionPoliciesClean(db: string): Promise<RetentionPolicyRow[]> {
		const res = await this.showRetentionPolicies(db);

		if (isArrayOfRetentionPolicies(res)) {
			return res;
		}

		const raw = res as unknown as InfluxResults;
		const series = raw.results?.[0]?.series?.[0];

		if (series?.values && Array.isArray(series.values)) {
			return series.values.map((row: unknown[]): RetentionPolicyRow => {
				const v = Array.isArray(row) ? row : [];

				return {
					default: Boolean(v[0]),
					duration: safeToString(v[1]),
					name: safeToString(v[2]),
					replicaN: safeNumber(v[3]),
					shardGroupDuration: safeToString(v[4]),
				};
			});
		}

		return [];
	}

	private async listContinuousQueriesClean(db?: string): Promise<ContinuousQueryRow[]> {
		const res = await this.showContinuousQueries(db);

		if (isArrayOfContinuousQueries(res)) {
			return res;
		}

		const raw = res as unknown as InfluxResults;
		const series = raw.results?.[0]?.series?.[0];

		if (series?.values && Array.isArray(series.values)) {
			return series.values.map((row: unknown[]): ContinuousQueryRow => {
				const v = Array.isArray(row) ? row : [];

				return {
					name: safeToString(v[0]),
					query: safeToString(v[1]),
				};
			});
		}

		return [];
	}

	private normalizeCqForCompare(q: string, db: string): string {
		if (!q) return '';

		let s = q.trim();
		const m = s.match(/begin\s*([\s\S]*?)\s*end/i);

		if (m) s = m[1];

		const dbPrefix = new RegExp(String.raw`(?:"?${db}"?\.)`, 'gi');

		s = s.replace(dbPrefix, '');
		s = s.replace(/"/g, '');
		s = s.toLowerCase();
		s = s.replace(/\s+/g, ' ').trim();
		s = s
			.replace(/\s*,\s*/g, ',')
			.replace(/\(\s*/g, '(')
			.replace(/\s*\)/g, ')');

		return s;
	}

	private normalizeCqResample(q: string): string {
		if (!q) return '';

		const s = q.toLowerCase();

		const m = s.match(
			/resample\s+(?:every\s+(\S+))?(?:\s+for\s+(\S+))?|resample\s+(?:for\s+(\S+))?(?:\s+every\s+(\S+))?/i,
		);

		if (!m) return '';

		const every = (m[1] || m[4] || '').trim();
		const dur = (m[2] || m[3] || '').trim();

		return `every=${every};for=${dur}`;
	}
}
