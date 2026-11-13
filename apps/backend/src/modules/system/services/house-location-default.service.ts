import { DataSource } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { WeatherConfigModel } from '../../weather/models/config.model';
import { WEATHER_MODULE_NAME } from '../../weather/weather.constants';
import { UpdateSystemConfigDto } from '../dto/update-config.dto';
import { SYSTEM_MODULE_NAME } from '../system.constants';
import { HouseLocation, getConfigHouseLocation } from '../utils/house-location.utils';

/** The table every weather location is stored in, whichever provider it belongs to */
const WEATHER_LOCATIONS_TABLE = 'weather_module_locations';

const isCoordinate = (value: unknown, limit: number): value is number =>
	typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * Gives an installation upgraded from a version without a house location the location of its primary
 * weather location (ADR 0003, decision 10).
 *
 * It runs at every start, and acts only while the configuration file holds no house location at all - a
 * file written before the location existed. Once the location has been stored, set or cleared, it is the
 * user's and is never touched again. A weather location without coordinates (an OpenWeatherMap city
 * name) gives nothing; the location is then set in the system settings.
 */
@Injectable()
export class HouseLocationDefaultService implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'HouseLocationDefaultService');

	constructor(
		private readonly configService: ConfigService,
		private readonly dataSource: DataSource,
	) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.applyDefault();
	}

	/** Returns the location it set, or null when it set nothing */
	async applyDefault(): Promise<HouseLocation | null> {
		try {
			if (
				this.configService.isModuleConfigValueStored(SYSTEM_MODULE_NAME, 'latitude') ||
				this.configService.isModuleConfigValueStored(SYSTEM_MODULE_NAME, 'longitude') ||
				getConfigHouseLocation(this.configService) !== null
			) {
				return null;
			}

			const location = await this.primaryWeatherLocation();

			if (!location) {
				this.logger.debug('[LOCATION] No weather location with coordinates to default the house location from');

				return null;
			}

			this.configService.setModuleConfig<UpdateSystemConfigDto>(SYSTEM_MODULE_NAME, {
				type: SYSTEM_MODULE_NAME,
				latitude: location.latitude,
				longitude: location.longitude,
			} as UpdateSystemConfigDto);

			this.logger.log('[LOCATION] The house location was set from the primary weather location');

			return location;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'unknown error';

			this.logger.warn(`[LOCATION] The house location could not be defaulted: ${message}`);

			return null;
		}
	}

	private async primaryWeatherLocation(): Promise<HouseLocation | null> {
		let primaryLocationId: string | null;

		try {
			primaryLocationId = this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME).primaryLocationId;
		} catch {
			return null;
		}

		if (!primaryLocationId) return null;

		const row = await this.dataSource
			.createQueryBuilder()
			.select('location.latitude', 'latitude')
			.addSelect('location.longitude', 'longitude')
			.from(WEATHER_LOCATIONS_TABLE, 'location')
			.where('location.id = :id', { id: primaryLocationId })
			.getRawOne<{ latitude: unknown; longitude: unknown }>();

		if (!row || !isCoordinate(row.latitude, 90) || !isCoordinate(row.longitude, 180)) return null;

		return { latitude: row.latitude, longitude: row.longitude };
	}
}
