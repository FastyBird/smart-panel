import { Cache } from 'cache-manager';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

@Injectable()
export class PropertyValueService {
	private readonly logger = new Logger(PropertyValueService.name);

	private readonly CACHE_TTL = 30 * 1000; // 30 seconds cache expiration

	constructor(
		private readonly influxDbService: InfluxDbService,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {}

	async write(property: ChannelPropertyEntity, value: string | boolean | number): Promise<void> {
		try {
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
					this.logger.error(`[PROPERTY] Unsupported data type dataType=${property.dataType} id=${property.id}`);

					return;
			}

			await this.influxDbService.writePoints([
				{
					measurement: 'property_value',
					tags: { propertyId: property.id },
					fields: formattedValue,
					timestamp: new Date(),
				},
			]);

			await this.cacheManager.set(this.createCacheKey(property), value, this.CACHE_TTL);

			this.logger.debug(`[PROPERTY] Value saved id=${property.id} dataType=${property.dataType} value=${value}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[PROPERTY] Failed to write value to InfluxDB id=${property.id} dataType=${property.dataType} error=${err.message}`,
				err.stack,
			);
		}
	}

	async readLatest(property: ChannelPropertyEntity): Promise<string | number | boolean | null> {
		try {
			const cachedValue = await this.cacheManager.get<string | number | boolean>(this.createCacheKey(property));

			if (cachedValue) {
				this.logger.debug(`[PROPERTY] Loaded cached value for property id=${property.id}, value=${cachedValue}`);

				return cachedValue;
			}

			const query = `
        SELECT * FROM property_value
        WHERE propertyId = '${property.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			this.logger.debug(`[PROPERTY] Fetching latest value id=${property.id}`);

			const result = await this.influxDbService.query<{ stringValue?: string; numberValue?: number }>(query);

			if (!result.length) {
				this.logger.warn(`[PROPERTY] No stored value found for id=${property.id}`);

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

			this.logger.debug(
				`[PROPERTY] Read latest value id=${property.id} dataType=${property.dataType} value=${parsedValue}`,
			);

			await this.cacheManager.set(this.createCacheKey(property), parsedValue, this.CACHE_TTL);

			return parsedValue;
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[PROPERTY] Failed to read latest value from InfluxDB id=${property.id} error=${err.message}`,
				err.stack,
			);

			return null;
		}
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
		try {
			const query = `DELETE FROM property_value WHERE propertyId = '${property.id}'`;

			await this.influxDbService.query(query);

			await this.cacheManager.del(this.createCacheKey(property));

			this.logger.log(`[PROPERTY] Deleted all stored values for id=${property.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[PROPERTY] Failed to delete property data from InfluxDB propertyId=${property.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	private createCacheKey(property: ChannelPropertyEntity): string {
		return `property:${property.id}:value`;
	}
}
