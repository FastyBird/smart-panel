import { Controller, Get } from '@nestjs/common';

import { WeatherService } from '../services/weather.service';

@Controller('weather')
export class WeatherController {
	constructor(private readonly weatherService: WeatherService) {}

	@Get()
	async getWeather() {
		return this.weatherService.getWeather();
	}
}
