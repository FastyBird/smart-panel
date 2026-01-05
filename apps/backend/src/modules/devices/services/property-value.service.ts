import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DEVICES_MODULE_NAME, DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

@Injectable()
export class PropertyValueService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueService');

	private valuesMap: Map<ChannelPropertyEntity['id'], string | boolean | number | null> = new Map();

	constructor(private readonly influxDbService: InfluxDbService) {}

	/**
	 * Write property value to storage
	 * @returns true if value changed, false if value was the same or invalid
	 */
	async write(property: ChannelPropertyEntity, value: string | boolean | number): Promise<boolean> {
		if (this.valuesMap.has(property.id) && this.valuesMap.get(property.id) === value) {
			// no change → skip Influx write
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

		// Update local cache regardless of InfluxDB availability
		this.valuesMap.set(property.id, value);

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

	async readLatest(property: ChannelPropertyEntity): Promise<string | number | boolean | null> {
		// Check local cache first
		if (this.valuesMap.has(property.id)) {
			this.logger.debug(`Loaded cached value for property id=${property.id}, value=${this.valuesMap.get(property.id)}`);

			return this.valuesMap.get(property.id);
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
        LIMIT 1
      `;

			this.logger.debug(`Fetching latest value id=${property.id}`);

			const result = await this.influxDbService.query<{
				stringValue?: string;
				numberValue?: number;
				propertyId: ChannelPropertyEntity['id'];
			}>(query);

			if (!result.length) {
				this.logger.debug(`No stored value found for id=${property.id}`);

				return null;
			}

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

			this.logger.debug(`Read latest value id=${property.id} dataType=${property.dataType} value=${parsedValue}`);

			this.valuesMap.set(property.id, parsedValue);

			return parsedValue;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest value from InfluxDB id=${property.id} error=${err.message}`, err.stack);

			return null;
		}
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
		// Always clear local cache
		this.valuesMap.delete(property.id);

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
				if (format.every((item) => typeof item === 'string')) {
					const allowedValues = format as string[];
					const stringValue = String(value);
					if (!allowedValues.includes(stringValue)) {
						return `Value "${stringValue}" not in allowed values: [${allowedValues.join(', ')}]`;
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
}
