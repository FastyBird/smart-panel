import { IPingStats, IQueryOptions, IResults, ISchemaOptions, InfluxDB } from 'influx';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { safeNumber, safeToString } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../config/services/config.service';
import { INFLUXDB_DEFAULT_DATABASE, INFLUXDB_DEFAULT_HOST, INFLUXDB_MODULE_NAME } from '../influxdb.constants';
import { InfluxDbConfigModel } from '../models/config.model';

import { InMemoryTimeSeriesStore } from './in-memory-timeseries.store';
import { InfluxQLParser } from './influxql-parser';

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

@Injectable()
export class InfluxDbService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(INFLUXDB_MODULE_NAME, 'InfluxDbService');
	private connection: InfluxDB | null = null;
	private readonly schemas: ISchemaOptions[] = [];

	/**
	 * In-memory fallback store used when InfluxDB is unavailable.
	 * Always initialized — data is written here AND to InfluxDB when connected.
	 * When InfluxDB is down, reads fall back to this store.
	 */
	private readonly memoryStore: InMemoryTimeSeriesStore;
	private readonly memoryParser: InfluxQLParser;

	/**
	 * Whether we are operating in fallback mode (InfluxDB unavailable).
	 * This is separate from connection === null during startup.
	 */
	private usingFallback = false;

	constructor(private readonly configService: ConfigService) {
		this.memoryStore = new InMemoryTimeSeriesStore();
		this.memoryParser = new InfluxQLParser(this.memoryStore);
	}

	/**
	 * Initialize connection after all module mappings are registered.
	 * This lifecycle hook runs after all onModuleInit hooks complete,
	 * ensuring the InfluxDB config mapping is available.
	 */
	async onApplicationBootstrap(): Promise<void> {
		try {
			await this.initializeConnection();
		} catch (error) {
			const err = error as Error;

			this.logger.error('Database can not be initialized', { message: err.message, stack: err.stack });
		}
	}

	onModuleDestroy(): void {
		this.memoryStore.destroy();
	}

	/**
	 * Get InfluxDB configuration from app config
	 */
	private getConfig(): InfluxDbConfigModel {
		try {
			return this.configService.getModuleConfig<InfluxDbConfigModel>(INFLUXDB_MODULE_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load InfluxDB configuration, using defaults',
				error instanceof Error ? error : String(error),
			);

			// Return default configuration
			const defaultConfig = new InfluxDbConfigModel();
			defaultConfig.type = INFLUXDB_MODULE_NAME;
			defaultConfig.host = INFLUXDB_DEFAULT_HOST;
			defaultConfig.database = INFLUXDB_DEFAULT_DATABASE;

			return defaultConfig;
		}
	}

	registerSchema(schema: ISchemaOptions): void {
		this.schemas.push(schema);
	}

	private async initializeConnection() {
		const config = this.getConfig();

		this.connection = new InfluxDB({
			host: config.host,
			database: config.database,
			username: config.username,
			password: config.password,
			schema: this.schemas,
		});

		await this.setupDatabase();
	}

	private async setupDatabase(): Promise<void> {
		try {
			const config = this.getConfig();
			const databases = await this.connection.getDatabaseNames();

			if (!databases.includes(config.database)) {
				await this.connection.createDatabase(config.database);
				this.logger.log(`Database '${config.database}' created.`);
			}

			await this.ensureRetentionPolicies(config.database);

			// If we were in fallback mode, we've recovered
			if (this.usingFallback) {
				this.logger.log('InfluxDB connection recovered — switching from in-memory fallback to InfluxDB');
				this.usingFallback = false;
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to connect to InfluxDB', { message: err.message, stack: err.stack });

			// Mark as disconnected and enable fallback
			this.connection = null;
			this.usingFallback = true;

			this.logger.warn('Using in-memory time-series storage as fallback. Data will not persist across restarts.');
		}
	}

	private getConnection(): InfluxDB {
		if (!this.connection) {
			throw new Error('InfluxDB connection is not initialized');
		}
		return this.connection;
	}

	public disconnect(): void {
		this.connection = null;
		this.logger.log('Connection closed.');
	}

	/**
	 * Returns true when the service is ready to accept reads and writes.
	 * This returns true both when InfluxDB is connected AND when the
	 * in-memory fallback is active, so consumers don't need to skip operations.
	 */
	public isConnected(): boolean {
		return this.connection !== null || this.usingFallback;
	}

	/**
	 * Returns true only when InfluxDB is actually connected (not fallback).
	 */
	public isInfluxDbConnected(): boolean {
		return this.connection !== null;
	}

	/**
	 * Returns true when operating in fallback (in-memory) mode.
	 */
	public isUsingFallback(): boolean {
		return this.usingFallback;
	}

	public async alterRetentionPolicy(...args: Parameters<InfluxDB['alterRetentionPolicy']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return; // No-op in fallback mode
		}

		return this.getConnection().alterRetentionPolicy(...args);
	}

	public async createContinuousQuery(...args: Parameters<InfluxDB['createContinuousQuery']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return; // No-op in fallback mode
		}

		const [name, body, db, resample] = args;

		if (!db) {
			const config = this.getConfig();

			return this.createContinuousQuery(name, body, config.database, resample);
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

	public async createDatabase(...args: Parameters<InfluxDB['createDatabase']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().createDatabase(...args);
	}

	public async createRetentionPolicy(...args: Parameters<InfluxDB['createRetentionPolicy']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().createRetentionPolicy(...args);
	}

	public async createUser(...args: Parameters<InfluxDB['createUser']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().createUser(...args);
	}

	public async dropContinuousQuery(...args: Parameters<InfluxDB['dropContinuousQuery']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropContinuousQuery(...args);
	}

	public async dropDatabase(...args: Parameters<InfluxDB['dropDatabase']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropDatabase(...args);
	}

	public async dropMeasurement(...args: Parameters<InfluxDB['dropMeasurement']>): Promise<void> {
		// Always drop from memory store
		if (typeof args[0] === 'string') {
			this.memoryStore.dropMeasurement(args[0]);
		}

		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropMeasurement(...args);
	}

	public async dropRetentionPolicy(...args: Parameters<InfluxDB['dropRetentionPolicy']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropRetentionPolicy(...args);
	}

	public async dropSeries(...args: Parameters<InfluxDB['dropSeries']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropSeries(...args);
	}

	public async dropUser(...args: Parameters<InfluxDB['dropUser']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().dropUser(...args);
	}

	public async getDatabaseNames(...args: Parameters<InfluxDB['getDatabaseNames']>): Promise<string[]> {
		if (this.usingFallback && !this.connection) {
			return ['in-memory'];
		}

		return this.getConnection().getDatabaseNames(...args);
	}

	public async getMeasurements(...args: Parameters<InfluxDB['getMeasurements']>): Promise<string[]> {
		if (this.usingFallback && !this.connection) {
			return this.memoryStore.getMeasurements();
		}

		return this.getConnection().getMeasurements(...args);
	}

	public async getSeries(...args: Parameters<InfluxDB['getSeries']>): Promise<string[]> {
		if (this.usingFallback && !this.connection) {
			return [];
		}

		return this.getConnection().getSeries(...args);
	}

	public async getUsers(...args: Parameters<InfluxDB['getUsers']>): Promise<Array<{ user: string; admin: boolean }>> {
		if (this.usingFallback && !this.connection) {
			return [];
		}

		return this.getConnection().getUsers(...args);
	}

	public async grantAdminPrivilege(...args: Parameters<InfluxDB['grantAdminPrivilege']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().grantAdminPrivilege(...args);
	}

	public async grantPrivilege(...args: Parameters<InfluxDB['grantPrivilege']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().grantPrivilege(...args);
	}

	public async ping(...args: Parameters<InfluxDB['ping']>): Promise<IPingStats[]> {
		if (this.usingFallback && !this.connection) {
			return [];
		}

		return this.getConnection().ping(...args);
	}

	async query<T>(query: string, options?: IQueryOptions): Promise<IResults<T>> {
		// Always try InfluxDB first if connected
		if (this.connection) {
			try {
				return await this.connection.query(query, options);
			} catch (error) {
				const err = error as Error;

				// Handle "database not found" gracefully - return empty results
				if (err.message?.includes('database not found')) {
					this.logger.warn('Database not found, returning empty results. Attempting to recreate...');

					// Try to recreate the database
					void this.setupDatabase();

					return [] as unknown as IResults<T>;
				}

				throw error;
			}
		}

		// Fallback to in-memory store
		if (this.usingFallback) {
			try {
				const results = this.memoryParser.execute<T>(query);

				return results as unknown as IResults<T>;
			} catch (error) {
				const err = error as Error;

				this.logger.warn(`In-memory query failed: ${err.message}`);

				return [] as unknown as IResults<T>;
			}
		}

		return [] as unknown as IResults<T>;
	}

	async queryRaw<T>(query: string, options?: IQueryOptions): Promise<T> {
		if (this.connection) {
			try {
				return (await this.connection.queryRaw(query, options)) as T;
			} catch (error) {
				const err = error as Error;

				// Handle "database not found" gracefully
				if (err.message?.includes('database not found')) {
					this.logger.warn('Database not found, returning empty results. Attempting to recreate...');

					// Try to recreate the database
					void this.setupDatabase();

					return { results: [] } as T;
				}

				throw error;
			}
		}

		// Fallback: return empty raw results
		if (this.usingFallback) {
			return { results: [] } as T;
		}

		return { results: [] } as T;
	}

	public async revokeAdminPrivilege(...args: Parameters<InfluxDB['revokeAdminPrivilege']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().revokeAdminPrivilege(...args);
	}

	public async revokePrivilege(...args: Parameters<InfluxDB['revokePrivilege']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().revokePrivilege(...args);
	}

	public async setPassword(...args: Parameters<InfluxDB['setPassword']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return;
		}

		return this.getConnection().setPassword(...args);
	}

	public async showContinuousQueries(...args: Parameters<InfluxDB['showContinousQueries']>): Promise<
		IResults<{
			name: string;
			query: string;
		}>
	> {
		if (this.usingFallback && !this.connection) {
			return [] as unknown as IResults<{ name: string; query: string }>;
		}

		return this.getConnection().showContinousQueries(...args);
	}

	public async showRetentionPolicies(...args: Parameters<InfluxDB['showRetentionPolicies']>): Promise<
		IResults<{
			default: boolean;
			duration: string;
			name: string;
			replicaN: number;
			shardGroupDuration: string;
		}>
	> {
		if (this.usingFallback && !this.connection) {
			return [] as unknown as IResults<{
				default: boolean;
				duration: string;
				name: string;
				replicaN: number;
				shardGroupDuration: string;
			}>;
		}

		return this.getConnection().showRetentionPolicies(...args);
	}

	public async writeMeasurement(...args: Parameters<InfluxDB['writeMeasurement']>): Promise<void> {
		if (this.usingFallback && !this.connection) {
			return; // writeMeasurement uses a different interface — skip in fallback
		}

		return this.getConnection().writeMeasurement(...args);
	}

	public async writePoints(...args: Parameters<InfluxDB['writePoints']>): Promise<void> {
		const points = args[0];

		// Always write to in-memory store for fallback reads
		this.memoryStore.writePoints(points);

		// Also write to InfluxDB if connected
		if (this.connection) {
			return this.connection.writePoints(...args);
		}

		// In fallback mode, the in-memory write above is sufficient
		if (this.usingFallback) {
			return;
		}

		// Neither connected nor fallback — this shouldn't happen but handle gracefully
		throw new Error('InfluxDB connection is not initialized');
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

		// Case 1: some Influx drivers return a flat array already (typed by us)
		if (isArrayOfRetentionPolicies(res)) {
			return res;
		}

		// Case 2: raw Influx shape: { results: [ { series: [ { values: [...] } ] } ] }
		const raw = res as unknown as InfluxResults;
		const series = raw.results?.[0]?.series?.[0];

		if (series?.values && Array.isArray(series.values)) {
			// Expected order for show retention policies:
			// [ default:boolean, duration:string, name:string, replicaN:number, shardGroupDuration:string ]
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

		// Case 1: flat array shape
		if (isArrayOfContinuousQueries(res)) {
			return res;
		}

		// Case 2: raw Influx shape
		const raw = res as unknown as InfluxResults;
		const series = raw.results?.[0]?.series?.[0];

		if (series?.values && Array.isArray(series.values)) {
			// Expected order for show continuous queries:
			// [ name:string, query:string ]
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
		if (!q) {
			return '';
		}

		let s = q.trim();

		const m = s.match(/begin\s*([\s\S]*?)\s*end/i);

		if (m) {
			s = m[1];
		}

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
		if (!q) {
			return '';
		}

		const s = q.toLowerCase();

		// Match RESAMPLE with ANY order of EVERY/FOR and optional presence
		// Examples:
		//   RESAMPLE EVERY 1m FOR 10m
		//   RESAMPLE FOR 24h EVERY 1m
		//   RESAMPLE EVERY 1m
		//   RESAMPLE FOR 24h
		const m = s.match(
			/resample\s+(?:every\s+(\S+))?(?:\s+for\s+(\S+))?|resample\s+(?:for\s+(\S+))?(?:\s+every\s+(\S+))?/i,
		);

		if (!m) {
			return '';
		}

		const every = (m[1] || m[4] || '').trim();
		const dur = (m[2] || m[3] || '').trim();

		return `every=${every};for=${dur}`;
	}
}
