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

function unescapeInfluxString(value: string): string {
	return value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function fluxString(value: string): string {
	return JSON.stringify(value);
}

function translateStrictInfluxQl(query: string, bucket: string): string {
	const compact = query.trim().replace(/\s+/g, ' ');

	if (!/^SELECT\b/i.test(compact)) {
		return query;
	}

	const statement = compact.match(
		/^SELECT (.+?) FROM ([A-Za-z_][\w]*) WHERE (.+?)(?: GROUP BY (.+?))? ORDER BY time (ASC|DESC)(?: LIMIT (\d+))?$/i,
	);

	if (!statement) {
		throw new Error('InfluxDB v2 cannot translate the strict storage query');
	}

	const [, selectClause, measurement, whereClause, groupByClause, orderDirection, limitValue] = statement;
	const startMatch = whereClause.match(/time\s*>=\s*(\d+)ms/i);
	const stopMatch = whereClause.match(/time\s*<=\s*(\d+)ms/i);
	const start = startMatch ? `time(v: ${fluxString(new Date(Number(startMatch[1])).toISOString())})` : '0';
	const stop = stopMatch ? `, stop: time(v: ${fluxString(new Date(Number(stopMatch[1]) + 1).toISOString())})` : '';
	const tagValues = new Map<string, string[]>();
	const equalityPattern = /([A-Za-z_][\w]*)\s*=\s*'((?:\\.|[^'])*)'/g;

	for (const match of whereClause.matchAll(equalityPattern)) {
		const [, key, rawValue] = match;

		if (key.toLowerCase() !== 'time') {
			tagValues.set(key, [...(tagValues.get(key) ?? []), unescapeInfluxString(rawValue)]);
		}
	}

	const tagFilters = [...tagValues.entries()].map(
		([key, values]) => `  |> filter(fn: (r) => contains(value: r.${key}, set: [${values.map(fluxString).join(', ')}]))`,
	);
	const selectedFields = [...selectClause.matchAll(/(?:^|,\s*)(?:MEAN|LAST)?\(?"?([A-Za-z_][\w]*)"?\)?/gi)]
		.map((match) => match[1])
		.filter((field) => field !== '*');
	const fieldFilter =
		selectedFields.length > 0
			? `  |> filter(fn: (r) => contains(value: r._field, set: [${selectedFields.map(fluxString).join(', ')}]))`
			: null;
	const base = [
		`from(bucket: ${fluxString(bucket)})`,
		`  |> range(start: ${start}${stop})`,
		`  |> filter(fn: (r) => r._measurement == ${fluxString(measurement)})`,
		...tagFilters,
	];
	const windowMatch = groupByClause?.match(/time\(([^)]+)\)/i);

	if (windowMatch) {
		const every = windowMatch[1];
		const aggregatePipelines: string[] = [];

		if (/MEAN\s*\(\s*"?numberValue"?\s*\)/i.test(selectClause)) {
			aggregatePipelines.push(
				`numberValues = ${[...base, '  |> filter(fn: (r) => r._field == "numberValue")', `  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)`].join('\n')}`,
			);
		}
		if (/LAST\s*\(\s*"?stringValue"?\s*\)/i.test(selectClause)) {
			aggregatePipelines.push(
				`stringValues = ${[...base, '  |> filter(fn: (r) => r._field == "stringValue")', `  |> aggregateWindow(every: ${every}, fn: last, createEmpty: false)`].join('\n')}`,
			);
		}

		if (aggregatePipelines.length === 0) {
			throw new Error('InfluxDB v2 cannot translate the strict aggregate query');
		}

		const names = aggregatePipelines.map((pipeline) => pipeline.slice(0, pipeline.indexOf(' =')));

		return [
			...aggregatePipelines,
			`union(tables: [${names.join(', ')}])`,
			'  |> group()',
			'  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")',
			`  |> sort(columns: ["_time"], desc: ${orderDirection.toUpperCase() === 'DESC'})`,
		].join('\n');
	}

	const tagGroupMatch = groupByClause?.match(/^"?([A-Za-z_][\w]*)"?$/);
	const pipeline = [...base];

	if (fieldFilter) {
		pipeline.push(fieldFilter);
	}
	if (tagGroupMatch) {
		pipeline.push(`  |> group(columns: [${fluxString(tagGroupMatch[1])}])`);
	} else {
		pipeline.push('  |> group()');
	}

	pipeline.push(
		'  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")',
		`  |> sort(columns: ["_time"], desc: ${orderDirection.toUpperCase() === 'DESC'})`,
	);

	if (limitValue) {
		pipeline.push(`  |> limit(n: ${Number(limitValue)})`);
	}

	return pipeline.join('\n');
}

function normalizeFluxRows<T>(rows: Array<Record<string, unknown>>): T[] {
	return rows.map((row) => {
		const { _time, ...values } = row;
		let time: string | undefined;

		if (typeof _time === 'string') {
			time = _time;
		} else if (_time instanceof Date) {
			time = _time.toISOString();
		} else if (typeof _time === 'number') {
			time = new Date(_time).toISOString();
		} else if (_time !== undefined) {
			throw new Error('InfluxDB v2 returned an unsupported timestamp');
		}

		return {
			...values,
			...(time === undefined ? {} : { time }),
		} as T;
	});
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

	async queryStrict<T>(query: string, _options?: StorageQueryOptions): Promise<T[]> {
		const fluxQuery = translateStrictInfluxQl(query, this.config.bucket);
		const rows = await this.getQueryApi().collectRows<Record<string, unknown>>(fluxQuery);

		return normalizeFluxRows<T>(rows);
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

			throw new Error(`Failed to drop measurement '${measurement}': ${response.status} ${body}`);
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
