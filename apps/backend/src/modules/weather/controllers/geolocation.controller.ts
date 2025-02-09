import { Controller, Get, Query } from '@nestjs/common';

import { GeolocationService } from '../services/geolocation.service';

@Controller('geolocation')
export class GeolocationController {
	constructor(private readonly geolocationService: GeolocationService) {}

	@Get('city-to-coordinates')
	async getCoordinates(@Query('city') city: string) {
		return this.geolocationService.getCoordinatesByCity(city);
	}

	@Get('coordinates-to-city')
	async getCity(@Query('lat') lat: number, @Query('lon') lon: number) {
		return this.geolocationService.getCityByCoordinates(lat, lon);
	}
}
