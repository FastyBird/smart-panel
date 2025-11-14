import { plainToInstance } from 'class-transformer';

import { Injectable, Logger } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyTimeseriesModel, TimeseriesPointModel } from '../models/devices.model';

export type BucketDuration = '1m' | '5m' | '15m' | '1h';

@Injectable()
export class PropertyTimeseriesService {
	private readonly logger = new Logger(PropertyTimeseriesService.name);

	constructor(private readonly influxDbService: InfluxDbService) {}

	/**
	 * Query timeseries data for a property within a time range
	 */
	async queryTimeseries(
		property: ChannelPropertyEntity,
		from: Date,
		to: Date,
		bucket?: BucketDuration,
	): Promise<PropertyTimeseriesModel> {
		this.logger.debug(
			`[TIMESERIES] Querying property id=${property.id} from=${from.toISOString()} to=${to.toISOString()} bucket=${bucket ?? 'none'}`,
		);

		try {
			const points = await this.fetchPoints(property, from, to, bucket);

			return plainToInstance(PropertyTimeseriesModel, {
				property: property.id,
				from: from.toISOString(),
				to: to.toISOString(),
				bucket: bucket ?? this.getDefaultBucket(from, to),
				points,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[TIMESERIES] Failed to query timeseries for property id=${property.id} error=${err.message}`,
				err.stack,
			);

			// Return empty result on error
			return plainToInstance(PropertyTimeseriesModel, {
				property: property.id,
				from: from.toISOString(),
				to: to.toISOString(),
				bucket: bucket ?? this.getDefaultBucket(from, to),
				points: [],
			});
		}
	}

	/**
	 * Fetch data points from InfluxDB with optional downsampling
	 */
	private async fetchPoints(
		property: ChannelPropertyEntity,
		from: Date,
		to: Date,
		bucket?: BucketDuration,
	): Promise<TimeseriesPointModel[]> {
		const effectiveBucket = bucket ?? this.getDefaultBucket(from, to);
		const query = this.buildQuery(property.id, from, to, effectiveBucket);

		this.logger.debug(`[TIMESERIES] Executing query: ${query}`);

		const result = await this.influxDbService.query<{
			time: { _nanoISO: string };
			stringValue?: string;
			numberValue?: number;
			propertyId: string;
		}>(query);

		if (!result.length) {
			this.logger.debug(`[TIMESERIES] No data found for property id=${property.id}`);

			return [];
		}

		// Parse results based on property data type
		const points = result.map((row) => {
			const time = row.time._nanoISO;
			const value = this.parseValue(row, property.dataType);

			return { time, value };
		});

		this.logger.debug(`[TIMESERIES] Retrieved ${points.length} points for property id=${property.id}`);

		return points;
	}

	/**
	 * Build InfluxQL query with optional downsampling
	 */
	private buildQuery(propertyId: string, from: Date, to: Date, bucket: string): string {
		const fromMs = from.getTime();
		const toMs = to.getTime();

		// Build the base SELECT clause with aggregation based on bucket
		const selectClause =
			bucket === 'raw'
				? `SELECT stringValue, numberValue`
				: `SELECT MEAN(numberValue) AS numberValue, LAST(stringValue) AS stringValue`;

		// Build the query
		let query = `
			${selectClause}
			FROM property_value
			WHERE propertyId = '${propertyId}'
			AND time >= ${fromMs}ms
			AND time <= ${toMs}ms
		`;

		// Add GROUP BY for downsampling
		if (bucket !== 'raw') {
			query += ` GROUP BY time(${bucket}) fill(none)`;
		}

		query += ` ORDER BY time ASC`;

		return query.trim().replace(/\s+/g, ' ');
	}

	/**
	 * Parse value from InfluxDB result based on data type
	 */
	private parseValue(
		row: { stringValue?: string; numberValue?: number },
		dataType: DataTypeType,
	): string | number | boolean | null {
		switch (dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				return row.stringValue ?? null;

			case DataTypeType.BOOL:
				return row.stringValue != null ? row.stringValue === 'true' : null;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
				return row.numberValue != null ? Math.round(row.numberValue) : null;

			case DataTypeType.FLOAT:
				return row.numberValue ?? null;

			default:
				return null;
		}
	}

	/**
	 * Determine default bucket based on time range duration
	 */
	private getDefaultBucket(from: Date, to: Date): string {
		const durationMs = to.getTime() - from.getTime();
		const durationHours = durationMs / (1000 * 60 * 60);

		// For very short ranges, return raw data
		if (durationHours <= 1) {
			return 'raw';
		}

		// For ranges up to 6 hours, use 1 minute buckets
		if (durationHours <= 6) {
			return '1m';
		}

		// For ranges up to 24 hours, use 5 minute buckets
		if (durationHours <= 24) {
			return '5m';
		}

		// For ranges up to 7 days, use 15 minute buckets
		if (durationHours <= 168) {
			return '15m';
		}

		// For longer ranges, use 1 hour buckets
		return '1h';
	}
}
