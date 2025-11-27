import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
} from '../../api/decorators/api-documentation.decorator';
import { GeolocationCityModel, GeolocationZipModel } from '../models/geolocation.model';
import { GeolocationService } from '../services/geolocation.service';

@ApiTags('weather-module')
@Controller('geolocation')
export class GeolocationController {
	constructor(private readonly geolocationService: GeolocationService) {}

	@Get('city-to-coordinates')
	@ApiOperation({
		summary: 'Get coordinates by city name',
		description: 'Convert city name to geographic coordinates',
	})
	@ApiQuery({ name: 'city', description: 'City name', type: 'string', example: 'London' })
	@ApiSuccessArrayResponse(GeolocationCityModel, 'City coordinates retrieved successfully')
	@ApiInternalServerErrorResponse()
	async getCityCoordinates(@Query('city') city: string) {
		return this.geolocationService.getCoordinatesByCity(city);
	}

	@Get('zip-to-coordinates')
	@ApiOperation({
		summary: 'Get coordinates by postal code',
		description: 'Convert postal/zip code to geographic coordinates',
	})
	@ApiQuery({ name: 'zip', description: 'Postal/zip code', type: 'string', example: 'SW1A 1AA' })
	@ApiSuccessResponse(GeolocationZipModel, 'Zip coordinates retrieved successfully')
	@ApiInternalServerErrorResponse()
	async getZipCoordinates(@Query('zip') zip: string) {
		return this.geolocationService.getCoordinatesByZip(zip);
	}

	@Get('coordinates-to-city')
	@ApiOperation({
		summary: 'Get city by coordinates',
		description: 'Convert geographic coordinates to city name',
	})
	@ApiQuery({ name: 'lat', description: 'Latitude', type: 'number', example: 51.5074 })
	@ApiQuery({ name: 'lon', description: 'Longitude', type: 'number', example: -0.1278 })
	@ApiSuccessArrayResponse(GeolocationCityModel, 'City information retrieved successfully')
	@ApiInternalServerErrorResponse()
	async getCity(@Query('lat') lat: number, @Query('lon') lon: number) {
		return this.geolocationService.getCityByCoordinates(lat, lon);
	}
}
