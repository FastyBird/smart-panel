import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WEATHER_MODULE_NAME } from '../weather.constants';

@Injectable()
export class WeatherModuleResetService {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'WeatherModuleResetService');

	constructor(
		@InjectRepository(WeatherLocationEntity)
		private readonly locationsRepository: Repository<WeatherLocationEntity>,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting weather module factory reset');

		try {
			await this.locationsRepository.clear();

			this.logger.log('[RESET] Weather module factory reset completed successfully');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Weather module factory reset failed: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
