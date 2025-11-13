import { IPingStats, IQueryOptions, IResults, ISchemaOptions, InfluxDB } from 'influx';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { safeNumber, safeToString } from '../../../common/utils/transform.utils';

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
export class InfluxDbService {
	private readonly logger = new Logger(InfluxDbService.name);
	private connection: InfluxDB | null = null;
	private readonly schemas: ISchemaOptions[] = [];

	constructor(private readonly configService: NestConfigService) {
		this.initializeConnection().catch((error) => {
			const err = error as Error;

			this.logger.error('[INFLUXDB] Database can not be initialized', { message: err.message, stack: err.stack });
		});
	}

	registerSchema(schema: ISchemaOptions): void {
		this.schemas.push(schema);
	}

	private async initializeConnection() {
		const host = getEnvValue<string>(this.configService, 'FB_INFLUXDB_HOST', 'localhost');
		const database = getEnvValue<string>(this.configService, 'FB_INFLUXDB_DB', 'fastybird');
		const username = getEnvValue<string | undefined>(this.configService, 'FB_INFLUXDB_USER', undefined);
		const password = getEnvValue<string | undefined>(this.configService, 'FB_INFLUXDB_PASSWORD', undefined);

		this.connection = new InfluxDB({
			host,
			database,
			username,
			password,
			schema: this.schemas,
		});

		await this.setupDatabase();
	}

	private async setupDatabase(): Promise<void> {
		try {
			const database = getEnvValue<string>(this.configService, 'FB_INFLUXDB_DB', 'fastybird');
			const databases = await this.connection.getDatabaseNames();

			if (!databases.includes(database)) {
				await this.connection.createDatabase(database);
				this.logger.log(`[INFLUXDB] Database '${database}' created.`);
			}

			await this.ensureRetentionPolicies(database);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[INFLUXDB] Failed to connect to InfluxDB', { message: err.message, stack: err.stack });
		}
	}

	private getConnection(): InfluxDB {
		if (!this.connection) {
			throw new Error('[INFLUXDB] InfluxDB connection is not initialized');
		}
		return this.connection;
	}

	public disconnect(): void {
		this.connection = null;
		this.logger.log('[INFLUXDB] Connection closed.');
	}

	public async alterRetentionPolicy(...args: Parameters<InfluxDB['alterRetentionPolicy']>): Promise<void> {
		return this.getConnection().alterRetentionPolicy(...args);
	}

	public async createContinuousQuery(...args: Parameters<InfluxDB['createContinuousQuery']>): Promise<void> {
		const [name, body, db, resample] = args;

		if (!db) {
			const cfgDb = getEnvValue<string>(this.configService, 'FB_INFLUXDB_DB', 'fastybird');

			return this.createContinuousQuery(name, body, cfgDb, resample);
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
		return this.getConnection().createDatabase(...args);
	}

	public async createRetentionPolicy(...args: Parameters<InfluxDB['createRetentionPolicy']>): Promise<void> {
		return this.getConnection().createRetentionPolicy(...args);
	}

	public async createUser(...args: Parameters<InfluxDB['createUser']>): Promise<void> {
		return this.getConnection().createUser(...args);
	}

	public async dropContinuousQuery(...args: Parameters<InfluxDB['dropContinuousQuery']>): Promise<void> {
		return this.getConnection().dropContinuousQuery(...args);
	}

	public async dropDatabase(...args: Parameters<InfluxDB['dropDatabase']>): Promise<void> {
		return this.getConnection().dropDatabase(...args);
	}

	public async dropMeasurement(...args: Parameters<InfluxDB['dropMeasurement']>): Promise<void> {
		return this.getConnection().dropMeasurement(...args);
	}

	public async dropRetentionPolicy(...args: Parameters<InfluxDB['dropRetentionPolicy']>): Promise<void> {
		return this.getConnection().dropRetentionPolicy(...args);
	}

	public async dropSeries(...args: Parameters<InfluxDB['dropSeries']>): Promise<void> {
		return this.getConnection().dropSeries(...args);
	}

	public async dropUser(...args: Parameters<InfluxDB['dropUser']>): Promise<void> {
		return this.getConnection().dropUser(...args);
	}

	public async getDatabaseNames(...args: Parameters<InfluxDB['getDatabaseNames']>): Promise<string[]> {
		return this.getConnection().getDatabaseNames(...args);
	}

	public async getMeasurements(...args: Parameters<InfluxDB['getMeasurements']>): Promise<string[]> {
		return this.getConnection().getMeasurements(...args);
	}

	public async getSeries(...args: Parameters<InfluxDB['getSeries']>): Promise<string[]> {
		return this.getConnection().getSeries(...args);
	}

	public async getUsers(...args: Parameters<InfluxDB['getUsers']>): Promise<Array<{ user: string; admin: boolean }>> {
		return this.getConnection().getUsers(...args);
	}

	public async grantAdminPrivilege(...args: Parameters<InfluxDB['grantAdminPrivilege']>): Promise<void> {
		return this.getConnection().grantAdminPrivilege(...args);
	}

	public async grantPrivilege(...args: Parameters<InfluxDB['grantPrivilege']>): Promise<void> {
		return this.getConnection().grantPrivilege(...args);
	}

	public async ping(...args: Parameters<InfluxDB['ping']>): Promise<IPingStats[]> {
		return this.getConnection().ping(...args);
	}

	query<T>(query: string, options?: IQueryOptions): Promise<IResults<T>> {
		return this.getConnection().query(query, options);
	}

	queryRaw<T>(query: string, options?: IQueryOptions): Promise<T> {
		return this.getConnection().queryRaw(query, options);
	}

	public async revokeAdminPrivilege(...args: Parameters<InfluxDB['revokeAdminPrivilege']>): Promise<void> {
		return this.getConnection().revokeAdminPrivilege(...args);
	}

	public async revokePrivilege(...args: Parameters<InfluxDB['revokePrivilege']>): Promise<void> {
		return this.getConnection().revokePrivilege(...args);
	}

	public async setPassword(...args: Parameters<InfluxDB['setPassword']>): Promise<void> {
		return this.getConnection().setPassword(...args);
	}

	public showContinuousQueries(...args: Parameters<InfluxDB['showContinousQueries']>): Promise<
		IResults<{
			name: string;
			query: string;
		}>
	> {
		return this.getConnection().showContinousQueries(...args);
	}

	public showRetentionPolicies(...args: Parameters<InfluxDB['showRetentionPolicies']>): Promise<
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

	public writeMeasurement(...args: Parameters<InfluxDB['writeMeasurement']>): Promise<void> {
		return this.getConnection().writeMeasurement(...args);
	}

	public writePoints(...args: Parameters<InfluxDB['writePoints']>): Promise<void> {
		return this.getConnection().writePoints(...args);
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
		const m = s.match(/resample\s+(?:every\s+(\S+))?(?:\s+for\s+(\S+))?|resample\s+(?:for\s+(\S+))?(?:\s+every\s+(\S+))?/i);

		if (!m) {
			return '';
		}

		const every = (m[1] || m[4] || '').trim();
		const dur = (m[2] || m[3] || '').trim();

		return `every=${every};for=${dur}`;
	}
}
