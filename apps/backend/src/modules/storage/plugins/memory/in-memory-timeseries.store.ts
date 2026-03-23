import { createExtensionLogger } from '../../../../common/logger';
import { StoragePoint } from '../../storage.types';

import { MEMORY_PLUGIN_NAME } from './memory.constants';

/**
 * Stored time-series point with normalized fields.
 */
export interface StoredPoint {
	measurement: string;
	tags: Record<string, string>;
	fields: Record<string, string | number | boolean>;
	timestamp: Date;
}

/**
 * In-memory time-series storage used as a fallback when InfluxDB is unavailable.
 *
 * Features:
 * - Stores data points organized by measurement name
 * - Automatic eviction of old data (configurable max age and max points)
 * - Supports basic query operations (filter by tags, time range, limit)
 * - Thread-safe for single-threaded Node.js event loop
 *
 * Limitations compared to InfluxDB:
 * - No continuous queries (aggregated measurements won't exist)
 * - No retention policies (single flat storage)
 * - Limited aggregation support
 * - Data is lost on process restart
 */
export class InMemoryTimeSeriesStore {
	private readonly logger = createExtensionLogger(MEMORY_PLUGIN_NAME, 'InMemoryTimeSeriesStore');

	private readonly data = new Map<string, StoredPoint[]>();

	/**
	 * Maximum number of points per measurement before oldest are evicted.
	 */
	private readonly maxPointsPerMeasurement: number;

	/**
	 * Maximum age in ms. Points older than this are evicted during cleanup.
	 */
	private readonly maxAgeMs: number;

	private evictionTimer: NodeJS.Timeout | null = null;

	constructor(maxPointsPerMeasurement = 10_000, maxAgeMs = 24 * 60 * 60 * 1000) {
		this.maxPointsPerMeasurement = maxPointsPerMeasurement;
		this.maxAgeMs = maxAgeMs;

		// Run eviction every 5 minutes
		this.evictionTimer = setInterval(() => this.evict(), 5 * 60 * 1000).unref();

		this.logger.log(
			`In-memory time-series store initialized (maxPoints=${maxPointsPerMeasurement}, maxAge=${maxAgeMs}ms)`,
		);
	}

	destroy(): void {
		if (this.evictionTimer) {
			clearInterval(this.evictionTimer);
			this.evictionTimer = null;
		}

		this.data.clear();
	}

	writePoints(points: StoragePoint[]): void {
		for (const point of points) {
			const measurement = point.measurement;

			if (!measurement) {
				continue;
			}

			const stored: StoredPoint = {
				measurement,
				tags: point.tags ?? {},
				fields: this.normalizeFields(point.fields ?? {}),
				timestamp: point.timestamp ?? new Date(),
			};

			let arr = this.data.get(measurement);

			if (!arr) {
				arr = [];
				this.data.set(measurement, arr);
			}

			arr.push(stored);

			if (arr.length > this.maxPointsPerMeasurement) {
				arr.splice(0, arr.length - this.maxPointsPerMeasurement);
			}
		}
	}

	query(
		measurement: string,
		where?: Record<string, string | string[]>,
		timeFrom?: Date,
		timeTo?: Date,
		orderDesc = true,
		limit?: number,
	): StoredPoint[] {
		const arr = this.data.get(measurement);

		if (!arr || arr.length === 0) {
			return [];
		}

		let filtered = arr;

		if (timeFrom || timeTo) {
			filtered = filtered.filter((p) => {
				if (timeFrom && p.timestamp < timeFrom) return false;
				if (timeTo && p.timestamp > timeTo) return false;

				return true;
			});
		}

		if (where && Object.keys(where).length > 0) {
			filtered = filtered.filter((p) => {
				return Object.entries(where).every(([key, value]) => {
					const pointValue = key in p.tags ? p.tags[key] : key in p.fields ? String(p.fields[key]) : undefined;

					if (pointValue === undefined) {
						return false;
					}

					if (Array.isArray(value)) {
						return value.includes(pointValue);
					}

					return pointValue === value;
				});
			});
		}

		const sorted = [...filtered].sort((a, b) => {
			return orderDesc ? b.timestamp.getTime() - a.timestamp.getTime() : a.timestamp.getTime() - b.timestamp.getTime();
		});

		if (limit && limit > 0) {
			return sorted.slice(0, limit);
		}

		return sorted;
	}

	queryGroupByTag(
		measurement: string,
		groupByTag: string,
		aggregations: Array<{ func: string; field: string; alias: string }>,
		where?: Record<string, string | string[]>,
		timeFrom?: Date,
		timeTo?: Date,
	): Array<Record<string, unknown>> {
		const points = this.query(measurement, where, timeFrom, timeTo, false);

		if (points.length === 0) {
			return [];
		}

		const groups = new Map<string, StoredPoint[]>();

		for (const point of points) {
			const tagValue = point.tags[groupByTag];

			if (!tagValue) {
				continue;
			}

			let group = groups.get(tagValue);

			if (!group) {
				group = [];
				groups.set(tagValue, group);
			}

			group.push(point);
		}

		const results: Array<Record<string, unknown>> = [];

		for (const [tagValue, groupPoints] of groups) {
			const row: Record<string, unknown> = {
				time: this.createNanoDate(groupPoints[groupPoints.length - 1].timestamp),
				[groupByTag]: tagValue,
			};

			for (const agg of aggregations) {
				const values = groupPoints.map((p) => p.fields[agg.field]).filter((v): v is number => typeof v === 'number');
				const allValues = groupPoints.map((p) => p.fields[agg.field]).filter((v) => v !== undefined);

				switch (agg.func.toUpperCase()) {
					case 'LAST':
						row[agg.alias] = allValues.length > 0 ? allValues[allValues.length - 1] : null;
						break;
					case 'MEAN':
						row[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
						break;
					case 'SUM':
						row[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
						break;
					case 'COUNT':
						row[agg.alias] = allValues.length;
						break;
					case 'MIN':
						row[agg.alias] = values.length > 0 ? Math.min(...values) : null;
						break;
					case 'MAX':
						row[agg.alias] = values.length > 0 ? Math.max(...values) : null;
						break;
					default:
						row[agg.alias] = null;
				}
			}

			results.push(row);
		}

		return results;
	}

	aggregate(
		measurement: string,
		aggregations: Array<{ func: string; field: string; alias: string }>,
		where?: Record<string, string | string[]>,
		timeFrom?: Date,
		timeTo?: Date,
	): Record<string, unknown> | null {
		const points = this.query(measurement, where, timeFrom, timeTo, false);

		if (points.length === 0) {
			return null;
		}

		const result: Record<string, unknown> = {};

		for (const agg of aggregations) {
			const values = points.map((p) => p.fields[agg.field]).filter((v): v is number => typeof v === 'number');

			switch (agg.func.toUpperCase()) {
				case 'MEAN':
					result[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
					break;
				case 'SUM':
					result[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
					break;
				case 'COUNT':
					result[agg.alias] = points.filter((p) => p.fields[agg.field] !== undefined).length;
					break;
				case 'MIN':
					result[agg.alias] = values.length > 0 ? Math.min(...values) : null;
					break;
				case 'MAX':
					result[agg.alias] = values.length > 0 ? Math.max(...values) : null;
					break;
				case 'LAST':
					if (points.length > 0) {
						result[agg.alias] = points[points.length - 1].fields[agg.field] ?? null;
					} else {
						result[agg.alias] = null;
					}
					break;
				default:
					result[agg.alias] = null;
			}
		}

		return result;
	}

	aggregateByTime(
		measurement: string,
		aggregations: Array<{ func: string; field: string; alias: string }>,
		bucketMs: number,
		where?: Record<string, string | string[]>,
		timeFrom?: Date,
		timeTo?: Date,
		fillNone = false,
	): Array<Record<string, unknown>> {
		const points = this.query(measurement, where, timeFrom, timeTo, false);

		if (points.length === 0) {
			return [];
		}

		const buckets = new Map<number, StoredPoint[]>();

		for (const point of points) {
			const bucketKey = Math.floor(point.timestamp.getTime() / bucketMs) * bucketMs;

			let bucket = buckets.get(bucketKey);

			if (!bucket) {
				bucket = [];
				buckets.set(bucketKey, bucket);
			}

			bucket.push(point);
		}

		const results: Array<Record<string, unknown>> = [];
		const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

		for (const bucketKey of sortedKeys) {
			const bucketPoints = buckets.get(bucketKey);

			if (!bucketPoints) {
				continue;
			}

			const row: Record<string, unknown> = {
				time: this.createNanoDate(new Date(bucketKey)),
			};

			let hasValues = false;

			for (const agg of aggregations) {
				const values = bucketPoints.map((p) => p.fields[agg.field]).filter((v): v is number => typeof v === 'number');

				const stringValues = bucketPoints.map((p) => p.fields[agg.field]).filter((v) => v !== undefined);

				switch (agg.func.toUpperCase()) {
					case 'MEAN':
						row[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
						if (values.length > 0) hasValues = true;
						break;
					case 'LAST':
						row[agg.alias] = stringValues.length > 0 ? stringValues[stringValues.length - 1] : null;
						if (stringValues.length > 0) hasValues = true;
						break;
					case 'COUNT':
						row[agg.alias] = stringValues.length;
						if (stringValues.length > 0) hasValues = true;
						break;
					case 'SUM':
						row[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
						if (values.length > 0) hasValues = true;
						break;
					case 'MIN':
						row[agg.alias] = values.length > 0 ? Math.min(...values) : null;
						if (values.length > 0) hasValues = true;
						break;
					case 'MAX':
						row[agg.alias] = values.length > 0 ? Math.max(...values) : null;
						if (values.length > 0) hasValues = true;
						break;
					default:
						row[agg.alias] = null;
				}
			}

			if (!fillNone || hasValues) {
				results.push(row);
			}
		}

		return results;
	}

	delete(measurement: string, where?: Record<string, string | string[]>): void {
		if (!where || Object.keys(where).length === 0) {
			this.data.delete(measurement);
			return;
		}

		const arr = this.data.get(measurement);

		if (!arr) {
			return;
		}

		const remaining = arr.filter((p) => {
			return !Object.entries(where).every(([key, value]) => {
				const pointValue = key in p.tags ? p.tags[key] : key in p.fields ? String(p.fields[key]) : undefined;

				if (pointValue === undefined) {
					return false;
				}

				if (Array.isArray(value)) {
					return value.includes(pointValue);
				}

				return pointValue === value;
			});
		});

		if (remaining.length === 0) {
			this.data.delete(measurement);
		} else {
			this.data.set(measurement, remaining);
		}
	}

	dropMeasurement(measurement: string): void {
		this.data.delete(measurement);
	}

	getMeasurements(): string[] {
		return [...this.data.keys()];
	}

	createNanoDate(date: Date): { _nanoISO: string; toISOString: () => string; getTime: () => number } {
		const iso = date.toISOString();

		return {
			_nanoISO: iso,
			toISOString: () => iso,
			getTime: () => date.getTime(),
		};
	}

	pointToRow(point: StoredPoint, selectFields?: string[]): Record<string, unknown> {
		const row: Record<string, unknown> = {
			time: this.createNanoDate(point.timestamp),
		};

		for (const [key, value] of Object.entries(point.tags)) {
			row[key] = value;
		}

		if (selectFields && selectFields.length > 0 && !selectFields.includes('*')) {
			for (const field of selectFields) {
				if (field in point.fields) {
					row[field] = point.fields[field];
				}
			}
		} else {
			for (const [key, value] of Object.entries(point.fields)) {
				row[key] = value;
			}
		}

		return row;
	}

	private normalizeFields(fields: Record<string, unknown>): Record<string, string | number | boolean> {
		const result: Record<string, string | number | boolean> = {};

		for (const [key, value] of Object.entries(fields)) {
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				result[key] = value;
			} else if (value !== null && value !== undefined) {
				result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean);
			}
		}

		return result;
	}

	private evict(): void {
		const cutoff = Date.now() - this.maxAgeMs;
		let totalEvicted = 0;

		for (const [measurement, points] of this.data) {
			const before = points.length;
			const remaining = points.filter((p) => p.timestamp.getTime() >= cutoff);

			if (remaining.length === 0) {
				this.data.delete(measurement);
				totalEvicted += before;
			} else if (remaining.length < before) {
				this.data.set(measurement, remaining);
				totalEvicted += before - remaining.length;
			}
		}

		if (totalEvicted > 0) {
			this.logger.debug(`Evicted ${totalEvicted} expired points`);
		}
	}
}
