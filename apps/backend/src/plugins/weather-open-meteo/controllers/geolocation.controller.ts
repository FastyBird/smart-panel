import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { OpenMeteoGeolocationCityToCoordinatesResponseModel } from '../models/geolocation.model';
import { OpenMeteoGeolocationService } from '../services/open-meteo-geolocation.service';
import { WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME, WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

@ApiTags(WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME)
@Controller('geolocation')
export class OpenMeteoGeolocationController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPEN_METEO_PLUGIN_NAME,
		'OpenMeteoGeolocationController',
	);

	constructor(private readonly geolocationService: OpenMeteoGeolocationService) {}

	@ApiOperation({
		tags: [WEATHER_OPEN_METEO_PLUGIN_API_TAG_NAME],
		summary: 'Get coordinates by city name',
		description: 'Convert city name to geographic coordinates using Open-Meteo Geocoding API (no API key required)',
		operationId: 'get-weather-open-meteo-city-geolocation',
	})
	@ApiQuery({ name: 'city', description: 'City name', type: 'string', example: 'London' })
	@ApiSuccessResponse(OpenMeteoGeolocationCityToCoordinatesResponseModel, 'City coordinates retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('city-to-coordinates')
	async getCityCoordinates(@Query('city') city: string): Promise<OpenMeteoGeolocationCityToCoordinatesResponseModel> {
		const data = await this.geolocationService.getCoordinatesByCity(city);

		const response = new OpenMeteoGeolocationCityToCoordinatesResponseModel();
		response.data = data || [];

		return response;
	}
}
