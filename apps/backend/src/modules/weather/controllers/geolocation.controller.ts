import { Controller, Get, Logger, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
} from '../models/weather-response.model';
import { GeolocationService } from '../services/geolocation.service';
import { WEATHER_MODULE_API_TAG_NAME } from '../weather.constants';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('geolocation')
export class GeolocationController {
	private readonly logger = new Logger(GeolocationController.name);

	constructor(private readonly geolocationService: GeolocationService) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get coordinates by city name',
		description: 'Convert city name to geographic coordinates',
		operationId: 'get-weather-module-city-geolocation',
	})
	@ApiQuery({ name: 'city', description: 'City name', type: 'string', example: 'London' })
	@ApiSuccessResponse(GeolocationCityToCoordinatesResponseModel, 'City coordinates retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('city-to-coordinates')
	async getCityCoordinates(@Query('city') city: string): Promise<GeolocationCityToCoordinatesResponseModel> {
		const data = await this.geolocationService.getCoordinatesByCity(city);

		const response = new GeolocationCityToCoordinatesResponseModel();
		response.data = data || [];

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get coordinates by postal code',
		description: 'Convert postal/zip code to geographic coordinates',
		operationId: 'get-weather-module-zip-geolocation',
	})
	@ApiQuery({ name: 'zip', description: 'Postal/zip code', type: 'string', example: 'SW1A 1AA' })
	@ApiSuccessResponse(GeolocationZipToCoordinatesResponseModel, 'Zip coordinates retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Coordinates for the specified postal code could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('zip-to-coordinates')
	async getZipCoordinates(@Query('zip') zip: string): Promise<GeolocationZipToCoordinatesResponseModel> {
		const data = await this.geolocationService.getCoordinatesByZip(zip);

		if (!data) {
			throw new NotFoundException('Coordinates for the specified postal code could not be found');
		}

		const response = new GeolocationZipToCoordinatesResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get city by coordinates',
		description: 'Convert geographic coordinates to city name',
		operationId: 'get-weather-module-geolocation-coordinates-to-city',
	})
	@ApiQuery({
		name: 'lat',
		description: 'Latitude of the location for reverse geocoding.',
		type: 'number',
		format: 'float',
		required: true,
		example: 51.5074,
	})
	@ApiQuery({
		name: 'lon',
		description: 'Longitude of the location for reverse geocoding.',
		type: 'number',
		format: 'float',
		required: true,
		example: -0.1278,
	})
	@ApiSuccessResponse(GeolocationCoordinatesToCityResponseModel, 'City information retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('coordinates-to-city')
	async getCity(
		@Query('lat') lat: number,
		@Query('lon') lon: number,
	): Promise<GeolocationCoordinatesToCityResponseModel> {
		const data = await this.geolocationService.getCityByCoordinates(lat, lon);

		const response = new GeolocationCoordinatesToCityResponseModel();
		response.data = data || [];

		return response;
	}
}
