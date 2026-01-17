import inquirer from 'inquirer';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { WEATHER_MODULE_NAME } from '../weather.constants';

import { LocationsTypeMapperService } from './locations-type-mapper.service';
import { LocationsService } from './locations.service';

// Default seed file name
const DEFAULT_LOCATIONS_FILE = 'weather_locations.json';

@Injectable()
export class WeatherSeederService implements Seeder {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'WeatherSeederService');

	constructor(
		private readonly locationsService: LocationsService,
		private readonly locationsMapperService: LocationsTypeMapperService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Weather module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Weather module.');

			return;
		}

		this.logger.log('[SEED] Seeding weather module...');

		let seededLocations = 0;

		const locations = this.seedTools.loadJsonData(DEFAULT_LOCATIONS_FILE);

		if (!locations.length) {
			this.logger.warn('[SEED] No weather locations found in weather_locations.json');
			return;
		}

		for (const location of locations) {
			try {
				// Check if location with this ID already exists
				if (location.id) {
					const existingLocation = await this.locationsService.findOne(location.id as string);

					if (existingLocation) {
						this.logger.debug(`[SEED] Weather location with id=${location.id} already exists, skipping`);
						continue;
					}
				}

				// Get the type-specific DTO class
				const locationType = location.type as string;
				const mapping = this.locationsMapperService.getMapping(locationType);

				const dtoInstance = toInstance(mapping.createDto, location);

				await this.locationsService.create(dtoInstance);

				seededLocations++;

				this.logger.debug(`[SEED] Created weather location: ${location.name}`);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create weather location: ${JSON.stringify(location)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		this.logger.log(`[SEED] Successfully seeded ${seededLocations} weather locations.`);
	}
}
