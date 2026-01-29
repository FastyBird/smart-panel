import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DEVICES_MODULE_NAME, DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState, type PropertyValueTrend } from '../models/property-value-state.model';

/**
 * Number of recent data points used for trend computation.
 */
const TREND_POINTS_COUNT = 5;

@Injectable()
export class PropertyValueService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueService');

	private valuesMap: Map<ChannelPropertyEntity['id'], PropertyValueState> = new Map();

	/**
	 * Cache of recent values for trend computation.
	 * Stores last N numeric values per property.
	 */
	private recentValuesMap: Map<ChannelPropertyEntity['id'], number[]> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	/**
	 * Write property value to storage
	 * @returns true if value changed, false if value was the same or invalid
	 */
	async write(property: ChannelPropertyEntity, value: string | boolean | number | null): Promise<boolean> {
		// Skip null values - device hasn't reported this property yet
		if (value === null || value === undefined) {
			return false;
		}

		// Skip invalid/sentinel values (e.g., -1 when sensor is off)
		// These are defined in the property's invalid field
		if (property.invalid !== null && this.isInvalidValue(property.invalid, value)) {
			this.logger.debug(`Skipping invalid/sentinel value for property id=${property.id}: value=${value}`);
			return false;
		}

		const cached = this.valuesMap.get(property.id);
		if (cached && cached.value === value) {
			// no change → skip Influx write, but refresh lastUpdated so freshness stays accurate
			cached.lastUpdated = new Date().toISOString();
			return false;
		}

		// Validate value against format constraints
		const validationError = this.validateValue(property, value);
		if (validationError) {
			this.logger.warn(
				`Invalid value for property id=${property.id}: ${validationError}. Value=${JSON.stringify(value)}`,
			);
			return false;
		}

		const formattedValue: { stringValue?: string; numberValue?: number } = {};

		switch (property.dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				formattedValue.stringValue = String(value);
				break;

			case DataTypeType.BOOL:
				formattedValue.stringValue = String(value ? 'true' : 'false');
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT:
				formattedValue.numberValue = Number(value);
				break;

			default:
				this.logger.error(`Unsupported data type dataType=${property.dataType} id=${property.id}`);

				return false;
		}

		const now = new Date().toISOString();

		// Update recent values cache for trend computation
		if (
			typeof value === 'number' ||
			(typeof value === 'string' && !isNaN(Number(value)) && this.isNumericDataType(property.dataType))
		) {
			const numValue = Number(value);
			const recent = this.recentValuesMap.get(property.id) ?? [];
			recent.push(numValue);
			if (recent.length > TREND_POINTS_COUNT) {
				recent.shift();
			}
			this.recentValuesMap.set(property.id, recent);
		}

		const trend = this.computeTrend(property);
		const state = new PropertyValueState(value, now, trend);

		// Update local cache regardless of InfluxDB availability
		this.valuesMap.set(property.id, state);

		if (!this.influxDbService.isConnected()) {
			return true; // Value changed in cache
		}

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'property_value',
					tags: { propertyId: property.id },
					fields: formattedValue,
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Value saved id=${property.id} dataType=${property.dataType} value=${value}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to write value to InfluxDB id=${property.id} dataType=${property.dataType} error=${err.message}`,
				err.stack,
			);
		}

		return true; // Value changed
	}

	async readLatest(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		// Check local cache first
		const cached = this.valuesMap.get(property.id);
		if (cached) {
			this.logger.debug(`Loaded cached value for property id=${property.id}, value=${cached.value}`);

			return cached;
		}

		// Return null if InfluxDB not connected
		if (!this.influxDbService.isConnected()) {
			return null;
		}

		try {
			const query = `
        SELECT * FROM property_value
        WHERE propertyId = '${property.id}'
        ORDER BY time DESC
        LIMIT ${TREND_POINTS_COUNT}
      `;

			this.logger.debug(`Fetching latest value id=${property.id}`);

			const result = await this.influxDbService.query<{
				time: Date | string;
				stringValue?: string;
				numberValue?: number;
				propertyId: ChannelPropertyEntity['id'];
			}>(query);

			if (!result.length) {
				this.logger.debug(`No stored value found for id=${property.id}`);

				return null;
			}

			// Results are ordered DESC, so first = latest
			const latest = result[0];

			let parsedValue: string | number | boolean | null = null;

			switch (property.dataType) {
				case DataTypeType.ENUM:
				case DataTypeType.STRING:
					parsedValue = latest.stringValue ?? null;
					break;

				case DataTypeType.BOOL:
					parsedValue = latest.stringValue != null ? latest.stringValue === 'true' : null;
					break;

				case DataTypeType.CHAR:
				case DataTypeType.UCHAR:
				case DataTypeType.SHORT:
				case DataTypeType.USHORT:
				case DataTypeType.INT:
				case DataTypeType.UINT:
					parsedValue = latest.numberValue != null ? Math.round(latest.numberValue) : null;
					break;

				case DataTypeType.FLOAT:
					parsedValue = latest.numberValue ?? null;
					break;

				default:
					parsedValue = null;
			}

			// Extract timestamp from InfluxDB result
			const lastUpdated = latest.time
				? latest.time instanceof Date
					? latest.time.toISOString()
					: String(latest.time)
				: null;

			// Build recent values cache from query results (for trend computation)
			if (this.isNumericDataType(property.dataType) && result.length >= 1) {
				// Results are DESC, reverse to get ASC order for trend
				const recentValues: number[] = [];
				for (let i = result.length - 1; i >= 0; i--) {
					const val = result[i].numberValue;
					if (val != null) {
						recentValues.push(val);
					}
				}
				this.recentValuesMap.set(property.id, recentValues);
			}

			const trend = this.computeTrend(property);
			const state = new PropertyValueState(parsedValue, lastUpdated, trend);

			this.logger.debug(`Read latest value id=${property.id} dataType=${property.dataType} value=${parsedValue}`);

			this.valuesMap.set(property.id, state);

			return state;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest value from InfluxDB id=${property.id} error=${err.message}`, err.stack);

			return null;
		}
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
		// Always clear local cache
		this.valuesMap.delete(property.id);
		this.recentValuesMap.delete(property.id);

		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM property_value WHERE propertyId = '${property.id}'`;

			await this.influxDbService.query(query);

			this.logger.log(`Deleted all stored values for id=${property.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to delete property data from InfluxDB propertyId=${property.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	/**
	 * Compute trend direction from recent cached values.
	 * Returns null for non-numeric types or insufficient data.
	 */
	private computeTrend(property: ChannelPropertyEntity): PropertyValueTrend | null {
		if (!this.isNumericDataType(property.dataType)) {
			return null;
		}

		const recent = this.recentValuesMap.get(property.id);
		if (!recent || recent.length < 2) {
			return null;
		}

		const first = recent[0];
		const last = recent[recent.length - 1];
		const delta = last - first;

		// Compute threshold: 0.5% of range if format provides min/max, else absolute 0.01
		let threshold = 0.01;
		if (property.format && property.format.length >= 2) {
			const min = typeof property.format[0] === 'number' ? property.format[0] : null;
			const max = typeof property.format[1] === 'number' ? property.format[1] : null;
			if (min !== null && max !== null && max > min) {
				threshold = (max - min) * 0.005;
			}
		}

		if (delta > threshold) {
			return 'rising';
		}
		if (delta < -threshold) {
			return 'falling';
		}
		return 'stable';
	}

	/**
	 * Check if a data type is numeric
	 */
	private isNumericDataType(dataType: DataTypeType): boolean {
		return [
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
			DataTypeType.FLOAT,
		].includes(dataType);
	}

	/**
	 * Validate value against property format constraints
	 * @returns error message if invalid, null if valid
	 */
	private validateValue(property: ChannelPropertyEntity, value: string | boolean | number): string | null {
		const { dataType, format } = property;

		// No format constraints defined - allow any value
		if (!format || format.length === 0) {
			return null;
		}

		switch (dataType) {
			case DataTypeType.ENUM:
				// For ENUM, format should be string[] of allowed values
				if (format.every((item): item is string => typeof item === 'string')) {
					const stringValue = String(value);
					if (!format.includes(stringValue)) {
						return `Value "${stringValue}" not in allowed values: [${format.join(', ')}]`;
					}
				}
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT: {
				// For numeric types, format can be [min, max], [min, null], [null, max], or [min]
				const numValue = Number(value);

				if (isNaN(numValue)) {
					return `Value "${value}" is not a valid number`;
				}

				const min = format.length >= 1 && typeof format[0] === 'number' ? format[0] : null;
				const max = format.length >= 2 && typeof format[1] === 'number' ? format[1] : null;

				if (min !== null && numValue < min) {
					return `Value ${numValue} below minimum ${min}`;
				}

				if (max !== null && numValue > max) {
					return `Value ${numValue} above maximum ${max}`;
				}
				break;
			}

			case DataTypeType.STRING:
			case DataTypeType.BOOL:
				// STRING and BOOL don't have format-based validation
				break;

			default:
				// Unknown data type - skip validation
				break;
		}

		return null;
	}

	/**
	 * Check if value matches the property's invalid/sentinel value
	 * Handles string↔number conversion (e.g., -1 as number vs "-1" as string)
	 */
	private isInvalidValue(invalidValue: string | boolean | number, value: string | boolean | number): boolean {
		// Direct equality check
		if (invalidValue === value) {
			return true;
		}

		// Handle string↔number conversion explicitly
		// Avoid loose equality (==) which has unintended side effects:
		// 0 == false, 1 == true, "" == 0, "1" == true all evaluate to true
		if (typeof invalidValue === 'number' && typeof value === 'string') {
			const numValue = Number(value);
			if (!Number.isNaN(numValue) && invalidValue === numValue) {
				return true;
			}
		}

		if (typeof invalidValue === 'string' && typeof value === 'number') {
			const numInvalid = Number(invalidValue);
			if (!Number.isNaN(numInvalid) && numInvalid === value) {
				return true;
			}
		}

		return false;
	}
}
