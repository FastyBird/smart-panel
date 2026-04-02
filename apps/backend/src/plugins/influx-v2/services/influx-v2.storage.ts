import { HttpError, InfluxDB, Point, QueryApi, WriteApi, flux } from '@influxdata/influxdb-client';

import { createExtensionLogger } from '../../../common/logger';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import {
	StorageFieldType,
	StorageMeasurementSchema,
	StoragePoint,
	StorageQueryOptions,
} from '../../../modules/storage/storage.types';
import {
	INFLUXDB_V2_DEFAULT_BUCKET,
	INFLUXDB_V2_DEFAULT_ORG,
	INFLUXDB_V2_DEFAULT_URL,
	INFLUX_V2_PLUGIN_NAME,
} from '../influx-v2.constants';

export interface InfluxV2Config {
	url: string;
	token?: string;
	org: string;
	bucket: string;
}

/**
 * Coerce a field value to boolean safely.
 * Handles string values like "false", "0", "no" correctly (unlike Boolean()).
 */
function toBoolean(value: string | number | boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;

	const lower = value.toLowerCase().trim();

	return lower !== '' && lower !== '0' && lower !== 'false' && lower !== 'no';
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
					p.booleanField(key, toBoolean(value));
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
export class InfluxV2Storage implements StoragePlugin {
	readonly name = INFLUX_V2_PLUGIN_NAME;

	private readonly logger = createExtensionLogger(INFLUX_V2_PLUGIN_NAME, 'InfluxV2Storage');

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
			const bucket = this.config.bucket;

			await this.getQueryApi().collectRows(flux`buckets() |> filter(fn: (r) => r.name == ${bucket})`);
			this.connected = true;
			this.logger.log('Successfully connected to InfluxDB v2.');
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to connect to InfluxDB v2', { message: err.message, stack: err.stack });

			// Clean up resources to prevent leaking the WriteApi auto-flush timer
			await this.destroy();
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

		try {
			await api.flush();
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to flush write points to InfluxDB v2', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	async query<T>(query: string, _options?: StorageQueryOptions): Promise<T[]> {
		try {
			const rows = await this.getQueryApi().collectRows<T>(query);

			return rows;
		} catch (error) {
			if (error instanceof HttpError && error.statusCode === 404) {
				this.logger.warn('Bucket not found, returning empty results.');

				return [];
			}

			throw error;
		}
	}

	async queryRaw<T>(query: string, _options?: StorageQueryOptions): Promise<T> {
		try {
			const result = await this.getQueryApi().collectRows(query);

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
		const url =
			`${this.config.url}/api/v2/delete` +
			`?org=${encodeURIComponent(this.config.org)}` +
			`&bucket=${encodeURIComponent(this.config.bucket)}`;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.config.token ? { Authorization: `Token ${this.config.token}` } : {}),
				},
				body: JSON.stringify({
					start: '1970-01-01T00:00:00Z',
					stop: '2099-12-31T23:59:59Z',
					predicate: `_measurement == "${measurement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
				}),
			});

			if (!response.ok) {
				const body = await response.text();

				this.logger.warn(`Failed to drop measurement '${measurement}': ${response.status} ${body}`);
			}
		} catch (error) {
			this.logger.warn(`Failed to drop measurement '${measurement}'`, (error as Error).message);
		}
	}

	async getMeasurements(): Promise<string[]> {
		try {
			const bucket = this.config.bucket;
			const query = flux`import "influxdata/influxdb/schema"
schema.measurements(bucket: ${bucket})`;

			const rows = await this.getQueryApi().collectRows<{ _value: string }>(query);

			return rows.map((row) => row._value);
		} catch (error) {
			if (error instanceof HttpError && error.statusCode === 404) {
				this.logger.warn('Bucket not found, returning empty measurements.');

				return [];
			}

			throw error;
		}
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
