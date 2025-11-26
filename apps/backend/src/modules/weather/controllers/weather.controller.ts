import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApiExtraModels, ApiOperation } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import {
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	LocationWeatherResponseModel,
} from '../models/weather-response.model';
import { CurrentDayModel, ForecastDayModel, LocationWeatherModel } from '../models/weather.model';
import { WeatherService } from '../services/weather.service';
import {
	WEATHER_MODULE_API_TAG_DESCRIPTION,
	WEATHER_MODULE_API_TAG_NAME,
	WEATHER_MODULE_NAME,
} from '../weather.constants';
import { WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@ApiTag({
	tagName: WEATHER_MODULE_NAME,
	displayName: WEATHER_MODULE_API_TAG_NAME,
	description: WEATHER_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(LocationWeatherResponseModel, LocationCurrentResponseModel, LocationForecastResponseModel)
@Controller('weather')
export class WeatherController {
	private readonly logger = new Logger(WeatherController.name);

	constructor(private readonly weatherService: WeatherService) {}

	@Get()
	@ApiOperation({
		summary: 'Get weather data',
		description: 'Retrieve current weather and forecast for configured location',
	})
	@ApiSuccessResponse(LocationWeatherModel, 'Weather data retrieved successfully')
	@ApiNotFoundResponse('Weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse()
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

	@Get('/current')
	@ApiOperation({
		summary: 'Get current weather',
		description: 'Retrieve current weather data for configured location',
	})
	@ApiSuccessResponse(CurrentDayModel, 'Current weather data retrieved successfully')
	@ApiNotFoundResponse('Current day weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse()
	async getCurrentWeather() {
		this.logger.debug('[LOOKUP] Fetching current weather data');

		try {
			return await this.weatherService.getCurrentWeather();
		} catch (error) {
			const err = error as Error;

			if (error instanceof WeatherValidationException) {
				this.logger.error('[ERROR] Weather module is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Weather module is not properly configured');
			} else if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException('Current day weather data could not be loaded from OpenWeatherMap');
			}

			this.logger.error('[ERROR] Loading weather failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@Get('/forecast')
	@ApiOperation({ summary: 'Get weather forecast', description: 'Retrieve weather forecast for configured location' })
	@ApiSuccessArrayResponse(ForecastDayModel, 'Forecast weather data retrieved successfully')
	@ApiNotFoundResponse('Current day weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse()
	async getForecastWeather() {
		this.logger.debug('[LOOKUP] Fetching forecast weather data');

		try {
			return await this.weatherService.getForecastWeather();
		} catch (error) {
			const err = error as Error;

			if (error instanceof WeatherValidationException) {
				this.logger.error('[ERROR] Weather module is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Weather module is not properly configured');
			} else if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException('Current day weather data could not be loaded from OpenWeatherMap');
			}

			this.logger.error('[ERROR] Loading weather failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
