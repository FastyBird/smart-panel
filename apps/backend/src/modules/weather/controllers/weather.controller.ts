import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { WeatherService } from '../services/weather.service';
import { WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@Controller('weather')
export class WeatherController {
	private readonly logger = new Logger(WeatherController.name);

	constructor(private readonly weatherService: WeatherService) {}

	@Get()
	async getWeather() {
		this.logger.debug('[LOOKUP] Fetching weather data');

		try {
			return await this.weatherService.getWeather();
		} catch (error) {
			const err = error as Error;

			if (error instanceof WeatherValidationException) {
				this.logger.error('[ERROR] Weather module is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Weather module is not properly configured');
			} else if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException('Weather data could not be loaded from OpenWeatherMap');
			}

			this.logger.error('[ERROR] Loading weather failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
