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

	async write(property: ChannelPropertyEntity, value: string | boolean | number): Promise<void> {
		if (this.valuesMap.has(property.id) && this.valuesMap.get(property.id) === value) {
			// no change → skip Influx write
			return;
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

				return;
		}

		// Update local cache regardless of InfluxDB availability
		this.valuesMap.set(property.id, value);

		if (!this.influxDbService.isConnected()) {
			return;
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
}
