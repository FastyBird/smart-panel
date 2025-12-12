import { Controller, Get, Logger, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	AllLocationsWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	LocationWeatherResponseModel,
} from '../models/weather-response.model';
import { WeatherService } from '../services/weather.service';
import { WEATHER_MODULE_API_TAG_NAME } from '../weather.constants';
import { WeatherNotFoundException } from '../weather.exceptions';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('weather')
export class WeatherController {
	private readonly logger = new Logger(WeatherController.name);

	constructor(private readonly weatherService: WeatherService) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather data for all locations',
		description: 'Retrieve current weather and forecast for all configured locations',
		operationId: 'get-weather-module-all-weather',
	})
	@ApiSuccessResponse(AllLocationsWeatherResponseModel, 'Weather data for all locations retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getAllWeather(): Promise<AllLocationsWeatherResponseModel> {
		this.logger.debug('[LOOKUP] Fetching weather data for all locations');

		const data = await this.weatherService.getAllWeather();

		const response = new AllLocationsWeatherResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather data for primary location',
		description: 'Retrieve current weather and forecast for the primary configured location',
		operationId: 'get-weather-module-primary-weather',
	})
	@ApiSuccessResponse(LocationWeatherResponseModel, 'Primary location weather data retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('No primary location configured or weather data could not be loaded')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('primary')
	async getPrimaryWeather(): Promise<LocationWeatherResponseModel> {
		this.logger.debug('[LOOKUP] Fetching weather data for primary location');

		try {
			const data = await this.weatherService.getPrimaryWeather();

			const response = new LocationWeatherResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather data for specific location',
		description: 'Retrieve current weather and forecast for a specific location',
		operationId: 'get-weather-module-location-weather',
	})
	@ApiParam({
		name: 'locationId',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		required: true,
	})
	@ApiSuccessResponse(LocationWeatherResponseModel, 'Weather data retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Location not found or weather data could not be loaded')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':locationId')
	async getWeather(@Param('locationId', ParseUUIDPipe) locationId: string): Promise<LocationWeatherResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching weather data for location=${locationId}`);

		try {
			const data = await this.weatherService.getWeather(locationId);

			const response = new LocationWeatherResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get current weather for specific location',
		description: 'Retrieve current weather data for a specific location',
		operationId: 'get-weather-module-location-current',
	})
	@ApiParam({
		name: 'locationId',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		required: true,
	})
	@ApiSuccessResponse(LocationCurrentResponseModel, 'Current weather data retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Location not found or current weather data could not be loaded')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':locationId/current')
	async getCurrentWeather(
		@Param('locationId', ParseUUIDPipe) locationId: string,
	): Promise<LocationCurrentResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching current weather data for location=${locationId}`);

		try {
			const data = await this.weatherService.getCurrentWeather(locationId);

			const response = new LocationCurrentResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather forecast for specific location',
		description: 'Retrieve weather forecast for a specific location',
		operationId: 'get-weather-module-location-forecast',
	})
	@ApiParam({
		name: 'locationId',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		required: true,
	})
	@ApiSuccessResponse(LocationForecastResponseModel, 'Forecast weather data retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Location not found or forecast data could not be loaded')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':locationId/forecast')
	async getForecastWeather(
		@Param('locationId', ParseUUIDPipe) locationId: string,
	): Promise<LocationForecastResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching forecast weather data for location=${locationId}`);

		try {
			const data = await this.weatherService.getForecastWeather(locationId);

			const response = new LocationForecastResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (error instanceof WeatherNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}
}
