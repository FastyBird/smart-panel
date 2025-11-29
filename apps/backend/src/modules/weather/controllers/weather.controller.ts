import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	LocationWeatherResponseModel,
} from '../models/weather-response.model';
import { WeatherService } from '../services/weather.service';
import { WEATHER_MODULE_API_TAG_NAME } from '../weather.constants';
import { WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('weather')
export class WeatherController {
	private readonly logger = new Logger(WeatherController.name);

	constructor(private readonly weatherService: WeatherService) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather data',
		description: 'Retrieve current weather and forecast for configured location',
		operationId: 'get-weather-module-weather',
	})
	@ApiSuccessResponse(LocationWeatherResponseModel, 'Weather data retrieved successfully')
	@ApiNotFoundResponse('Weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getWeather(): Promise<LocationWeatherResponseModel> {
		this.logger.debug('[LOOKUP] Fetching weather data');

		try {
			const data = await this.weatherService.getWeather();

			const response = new LocationWeatherResponseModel();
			response.data = data;

			return response;
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

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get current weather',
		description: 'Retrieve current weather data for configured location',
		operationId: 'get-weather-module-current',
	})
	@ApiSuccessResponse(LocationCurrentResponseModel, 'Current weather data retrieved successfully')
	@ApiNotFoundResponse('Current day weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('/current')
	async getCurrentWeather(): Promise<LocationCurrentResponseModel> {
		this.logger.debug('[LOOKUP] Fetching current weather data');

		try {
			const data = await this.weatherService.getCurrentWeather();

			const response = new LocationCurrentResponseModel();
			response.data = data;

			return response;
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

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather forecast',
		description: 'Retrieve weather forecast for configured location',
		operationId: 'get-weather-module-forecast',
	})
	@ApiSuccessResponse(LocationForecastResponseModel, 'Forecast weather data retrieved successfully')
	@ApiNotFoundResponse('Forecast weather data could not be loaded from OpenWeatherMap')
	@ApiUnprocessableEntityResponse('Weather module is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('/forecast')
	async getForecastWeather(): Promise<LocationForecastResponseModel> {
		this.logger.debug('[LOOKUP] Fetching forecast weather data');

		try {
			const data = await this.weatherService.getForecastWeather();

			const response = new LocationForecastResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof WeatherValidationException) {
				this.logger.error('[ERROR] Weather module is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Weather module is not properly configured');
			} else if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException('Forecast weather data could not be loaded from OpenWeatherMap');
			}

			this.logger.error('[ERROR] Loading weather failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
