import { IPingStats, IQueryOptions, IResults, ISchemaOptions, InfluxDB } from 'influx';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';

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
		return this.getConnection().createContinuousQuery(...args);
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
}
