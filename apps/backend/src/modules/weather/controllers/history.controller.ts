import { Controller, Get, Logger, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	WeatherHistoryPointModel,
	WeatherHistoryResponseModel,
	WeatherStatisticsModel,
	WeatherStatisticsResponseModel,
} from '../models/history.model';
import { LocationsService } from '../services/locations.service';
import { WeatherHistoryService } from '../services/weather-history.service';
import { WEATHER_MODULE_API_TAG_NAME } from '../weather.constants';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('weather')
export class HistoryController {
	private readonly logger = new Logger(HistoryController.name);

	constructor(
		private readonly historyService: WeatherHistoryService,
		private readonly locationsService: LocationsService,
	) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get historical weather data for a location',
		description:
			'Retrieve historical weather data points for a specific location. Data is stored when weather is fetched and retained based on InfluxDB retention policies.',
		operationId: 'get-weather-module-location-history',
	})
	@ApiParam({
		name: 'locationId',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		required: true,
	})
	@ApiQuery({
		name: 'startTime',
		description: 'Start time for history query (ISO 8601). Defaults to 24 hours ago.',
		type: 'string',
		format: 'date-time',
		required: false,
	})
	@ApiQuery({
		name: 'endTime',
		description: 'End time for history query (ISO 8601). Defaults to now.',
		type: 'string',
		format: 'date-time',
		required: false,
	})
	@ApiQuery({
		name: 'limit',
		description: 'Maximum number of data points to return. Defaults to 100.',
		type: 'integer',
		required: false,
	})
	@ApiSuccessResponse(WeatherHistoryResponseModel, 'Historical weather data retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Location not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':locationId/history')
	async getHistory(
		@Param('locationId', ParseUUIDPipe) locationId: string,
		@Query('startTime') startTime?: string,
		@Query('endTime') endTime?: string,
		@Query('limit') limit?: string,
	): Promise<WeatherHistoryResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching weather history for location=${locationId}`);

		// Verify location exists
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new NotFoundException(`Location with id=${locationId} not found`);
		}

		const history = await this.historyService.getHistory({
			locationId,
			startTime: startTime ? new Date(startTime) : undefined,
			endTime: endTime ? new Date(endTime) : undefined,
			limit: limit ? parseInt(limit, 10) : undefined,
		});

		const response = new WeatherHistoryResponseModel();
		response.data = history.map((point) =>
			toInstance(WeatherHistoryPointModel, {
				time: point.time,
				locationId: point.locationId,
				locationName: point.locationName,
				temperature: point.temperature,
				temperatureMin: point.temperatureMin,
				temperatureMax: point.temperatureMax,
				feelsLike: point.feelsLike,
				pressure: point.pressure,
				humidity: point.humidity,
				clouds: point.clouds,
				windSpeed: point.windSpeed,
				windDeg: point.windDeg,
				windGust: point.windGust,
				rain: point.rain,
				snow: point.snow,
				weatherCode: point.weatherCode,
				weatherMain: point.weatherMain,
			}),
		);

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get weather statistics for a location',
		description:
			'Retrieve aggregated weather statistics (averages, min/max, totals) for a specific location over a time period.',
		operationId: 'get-weather-module-location-statistics',
	})
	@ApiParam({
		name: 'locationId',
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		required: true,
	})
	@ApiQuery({
		name: 'startTime',
		description: 'Start time for statistics query (ISO 8601). Defaults to 7 days ago.',
		type: 'string',
		format: 'date-time',
		required: false,
	})
	@ApiQuery({
		name: 'endTime',
		description: 'End time for statistics query (ISO 8601). Defaults to now.',
		type: 'string',
		format: 'date-time',
		required: false,
	})
	@ApiSuccessResponse(WeatherStatisticsResponseModel, 'Weather statistics retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Location not found or no data available')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':locationId/statistics')
	async getStatistics(
		@Param('locationId', ParseUUIDPipe) locationId: string,
		@Query('startTime') startTime?: string,
		@Query('endTime') endTime?: string,
	): Promise<WeatherStatisticsResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching weather statistics for location=${locationId}`);

		// Verify location exists
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new NotFoundException(`Location with id=${locationId} not found`);
		}

		const statistics = await this.historyService.getStatistics(
			locationId,
			startTime ? new Date(startTime) : undefined,
			endTime ? new Date(endTime) : undefined,
		);

		if (!statistics) {
			throw new NotFoundException(`No weather data available for location=${locationId}`);
		}

		const response = new WeatherStatisticsResponseModel();
		response.data = toInstance(WeatherStatisticsModel, statistics);

		return response;
	}
}
