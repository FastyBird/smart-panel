import { HttpError, InfluxDB, Point, QueryApi, WriteApi } from '@influxdata/influxdb-client';

import { createExtensionLogger } from '../../common/logger';
import { StoragePlugin } from '../../modules/storage/interfaces/storage-plugin.interface';
import {
	StorageFieldType,
	StorageMeasurementSchema,
	StoragePoint,
	StorageQueryOptions,
} from '../../modules/storage/storage.types';

import {
	INFLUXDB_V2_DEFAULT_BUCKET,
	INFLUXDB_V2_DEFAULT_ORG,
	INFLUXDB_V2_DEFAULT_URL,
	INFLUX_V2_PLUGIN_NAME,
} from './influx-v2.constants';

export interface InfluxV2Config {
	url: string;
	token?: string;
	org: string;
	bucket: string;
}

/**
 * Convert a StoragePoint to an InfluxDB v2 Point.
 */
function toInfluxPoint(point: StoragePoint, schemas: Map<string, StorageMeasurementSchema>): Point {
	const p = new Point(point.measurement);

	if (point.tags) {
		for (const [key, value] of Object.entries(point.tags)) {
			p.tag(key, value);
		}
	}

	if (point.fields) {
		const schema = schemas.get(point.measurement);

		for (const [key, value] of Object.entries(point.fields)) {
			const fieldType = schema?.fields[key];

			switch (fieldType) {
				case StorageFieldType.INTEGER:
					p.intField(key, Number(value));
					break;
				case StorageFieldType.FLOAT:
					p.floatField(key, Number(value));
					break;
				case StorageFieldType.BOOLEAN:
					p.booleanField(key, Boolean(value));
					break;
				case StorageFieldType.STRING:
					p.stringField(key, String(value));
					break;
				default:
					if (typeof value === 'number') {
						p.floatField(key, value);
					} else if (typeof value === 'boolean') {
						p.booleanField(key, value);
					} else {
						p.stringField(key, String(value));
					}
					break;
			}
		}
	}

	if (point.timestamp) {
		p.timestamp(point.timestamp);
	}

	return p;
}

/**
 * InfluxDB v2.x storage plugin.
 *
 * Connects to an InfluxDB 2.x server and provides time-series
 * storage using the Flux query language, buckets, organizations,
 * and token-based authentication.
 */
export class InfluxV2StoragePlugin implements StoragePlugin {
	readonly name = INFLUX_V2_PLUGIN_NAME;

	private readonly logger = createExtensionLogger(INFLUX_V2_PLUGIN_NAME, 'InfluxV2StoragePlugin');

	private client: InfluxDB | null = null;
	private writeApi: WriteApi | null = null;
	private queryApi: QueryApi | null = null;
	private readonly schemas = new Map<string, StorageMeasurementSchema>();
	private config: InfluxV2Config;
	private connected = false;

	constructor(config?: Partial<InfluxV2Config>) {
		this.config = {
			url: config?.url ?? INFLUXDB_V2_DEFAULT_URL,
			token: config?.token,
			org: config?.org ?? INFLUXDB_V2_DEFAULT_ORG,
			bucket: config?.bucket ?? INFLUXDB_V2_DEFAULT_BUCKET,
		};
	}

	updateConfig(config: Partial<InfluxV2Config>): void {
		if (config.url) this.config.url = config.url;
		if (config.token !== undefined) this.config.token = config.token;
		if (config.org) this.config.org = config.org;
		if (config.bucket) this.config.bucket = config.bucket;
	}

	async initialize(): Promise<void> {
		this.client = new InfluxDB({
			url: this.config.url,
			token: this.config.token,
		});

		this.writeApi = this.client.getWriteApi(this.config.org, this.config.bucket, 'ns');
		this.queryApi = this.client.getQueryApi(this.config.org);

		try {
			// Verify connectivity by running a simple Flux query
			await this.getQueryApi().collectRows(`buckets() |> filter(fn: (r) => r.name == "${this.config.bucket}")`);
			this.connected = true;
			this.logger.log('Successfully connected to InfluxDB v2.');
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to connect to InfluxDB v2', { message: err.message, stack: err.stack });

			this.connected = false;
		}
	}

	async destroy(): Promise<void> {
		if (this.writeApi) {
			try {
				await this.writeApi.close();
			} catch {
				// Ignore close errors
			}
		}

		this.writeApi = null;
		this.queryApi = null;
		this.client = null;
		this.connected = false;

		this.logger.log('Connection closed.');
	}

	isAvailable(): boolean {
		return this.client !== null && this.connected;
	}

	// ─── Core Read/Write ──────────────────────────────────────────────

	async writePoints(points: StoragePoint[]): Promise<void> {
		const api = this.getWriteApi();

		for (const point of points) {
			api.writePoint(toInfluxPoint(point, this.schemas));
		}

		await api.flush();
	}

	async query<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		try {
			const queryApi = options?.database ? this.getClient().getQueryApi(options.database) : this.getQueryApi();

			const rows = await queryApi.collectRows<T>(query);

			return rows;
		} catch (error) {
			if (error instanceof HttpError && error.statusCode === 404) {
				this.logger.warn('Bucket not found, returning empty results.');

				return [];
			}

			throw error;
		}
	}

	async queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T> {
		try {
			const queryApi = options?.database ? this.getClient().getQueryApi(options.database) : this.getQueryApi();

			const result = await queryApi.collectRows(query);

			return result as T;
		} catch (error) {
			if (error instanceof HttpError && error.statusCode === 404) {
				this.logger.warn('Bucket not found, returning empty results.');

				return [] as T;
			}

			throw error;
		}
	}

	registerSchema(schema: StorageMeasurementSchema): void {
		this.schemas.set(schema.measurement, schema);
	}

	async dropMeasurement(measurement: string): Promise<void> {
		const query = `
			import "influxdata/influxdb"
			influxdb.deleteFrom(
				bucket: "${this.config.bucket}",
				start: 1970-01-01T00:00:00Z,
				stop: now(),
				predicate: (r) => r._measurement == "${measurement}"
			)
		`;

		try {
			await this.getQueryApi().collectRows(query);
		} catch (error) {
			this.logger.warn(`Failed to drop measurement '${measurement}'`, (error as Error).message);
		}
	}

	async getMeasurements(): Promise<string[]> {
		const query = `
			import "influxdata/influxdb/schema"
			schema.measurements(bucket: "${this.config.bucket}")
		`;

		const rows = await this.getQueryApi().collectRows<{ _value: string }>(query);

		return rows.map((row) => row._value);
	}

	// ─── InfluxDB v2-Specific Operations ──────────────────────────────

	async ping(): Promise<unknown[]> {
		try {
			const rows = await this.getQueryApi().collectRows('buckets() |> limit(n: 1)');

			return [{ online: true, results: rows }];
		} catch {
			return [{ online: false }];
		}
	}

	async getSeries(): Promise<string[]> {
		return this.getMeasurements();
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private getClient(): InfluxDB {
		if (!this.client) {
			throw new Error('InfluxDB v2 client is not initialized');
		}

		return this.client;
	}

	private getWriteApi(): WriteApi {
		if (!this.writeApi) {
			throw new Error('InfluxDB v2 write API is not initialized');
		}

		return this.writeApi;
	}

	private getQueryApi(): QueryApi {
		if (!this.queryApi) {
			throw new Error('InfluxDB v2 query API is not initialized');
		}

		return this.queryApi;
	}
}
