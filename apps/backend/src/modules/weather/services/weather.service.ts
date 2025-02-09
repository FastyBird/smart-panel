import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CronJob } from 'cron';
import fetch from 'node-fetch';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import {
	EventType as ConfigModuleEventType,
	LanguageEnum,
	WeatherLocationTypeEnum,
} from '../../config/config.constants';
import { LanguageConfigEntity, WeatherConfigEntity } from '../../config/entities/config.entity';
import { ConfigService } from '../../config/services/config.service';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { ForecastDto } from '../dto/forecast.dto';
import { WeatherDto } from '../dto/weather.dto';
import { ForecastEntity, LocationWeatherEntity, WeatherEntity } from '../entities/weather.entity';
import { EventType } from '../weather.constants';
import { WeatherException, WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@Injectable()
export class WeatherService {
	private readonly logger = new Logger(WeatherService.name);
	private readonly units: string;
	private readonly refreshJob: CronJob;

	private apiKey: string | null;
	private location: string;
	private locationType: WeatherLocationTypeEnum;
	private language: string = 'en';

	private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';
	private readonly CACHE_TTL = 3600000; // 1-hour cache expiration

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly configService: ConfigService,
		private readonly gateway: WebsocketGateway,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {
		this.units = 'metric';

		this.loadConfiguration();

		this.refreshJob = new CronJob(CronExpression.EVERY_HOUR, async () => {
			await this.refreshWeather();
		});

		this.schedulerRegistry.addCronJob('refreshWeather', this.refreshJob);

		if (this.apiKey !== null) {
			this.refreshJob.start();
		}
	}

	async getWeather(force = false): Promise<LocationWeatherEntity> {
		this.loadConfiguration();

		if (this.apiKey === null) {
			this.logger.warn('[WEATHER] Missing API key for weather service');

			throw new WeatherValidationException('Api key is required');
		}

		const cacheKey = `weather-forecast:${this.location}`;
		const cachedData = await this.cacheManager.get<LocationWeatherEntity>(cacheKey);

		if (cachedData && !force) {
			this.logger.debug(`[WEATHER] Returning cached weather data for location=${this.location}`);

			return cachedData;
		}

		try {
			this.logger.debug(`[WEATHER] Fetching weather data for location='${this.location}'`);

			const [weather, forecast] = await Promise.all([this.fetchCurrentWeather(), this.fetchWeatherForecast()]);

			if (weather && forecast) {
				const weatherData = plainToInstance(
					LocationWeatherEntity,
					{
						weather,
						forecast,
					},
					{
						excludeExtraneousValues: true,
					},
				);

				await this.cacheManager.set(cacheKey, weatherData, this.CACHE_TTL);

				return weatherData;
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data or forecast could not be loaded');
	}

	async refreshWeather(): Promise<void> {
		try {
			this.logger.debug('[WEATHER] Refreshing weather data...');

			const weather = await this.getWeather(true);

			this.gateway.sendMessage(EventType.WEATHER_INFO, weather);

			this.logger.debug('[EVENT] Weather info broadcasted successfully');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[EVENT] Failed to broadcast weather info', { message: err.message, stack: err.stack });
		}
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.loadConfiguration();

		if (this.apiKey) {
			if (!this.refreshJob.running) {
				this.logger.log('[WEATHER] Starting weather refresh job due to config update');

				this.refreshJob.start();
			}
		} else if (this.refreshJob.running) {
			this.logger.warn('[WEATHER] Stopping weather refresh job due to missing API key');

			this.refreshJob.stop();
		}
	}

	private loadConfiguration() {
		this.apiKey = this.configService.getConfigSection('weather', WeatherConfigEntity).openWeatherApiKey;

		this.location = this.configService.getConfigSection('weather', WeatherConfigEntity).location || 'Prague,CZ';

		this.locationType =
			this.configService.getConfigSection('weather', WeatherConfigEntity).locationType ||
			WeatherLocationTypeEnum.CITY_NAME;

		switch (this.configService.getConfigSection('language', LanguageConfigEntity).language) {
			case LanguageEnum.ENGLISH:
				this.language = 'en';
				break;
			case LanguageEnum.CZECH:
				this.language = 'cz';
				break;
		}
	}

	private async fetchCurrentWeather(): Promise<WeatherEntity | null> {
		const queryParams = this.buildQueryParams();

		const url = `${this.BASE_URL}/weather?${queryParams}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;

		try {
			const response = await fetch(url);

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] Weather API request failed: ${JSON.stringify(data)}`);

				return null;
			}

			const weather = plainToInstance(WeatherDto, data, { excludeExtraneousValues: true });

			const errors = await validate(weather);

			if (errors.length) {
				this.logger.error(`[VALIDATION] Weather response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return this.transformWeatherDto(weather);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });

			return null;
		}
	}

	private async fetchWeatherForecast(daysCnt = 7): Promise<ForecastEntity | null> {
		const queryParams = this.buildQueryParams();

		const url = `${this.BASE_URL}/forecast?${queryParams}&cnt=${daysCnt}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;

		try {
			const response = await fetch(url);

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] Forecast API request failed: ${JSON.stringify(data)}`);

				return null;
			}

			const forecast = plainToInstance(ForecastDto, data, { excludeExtraneousValues: true });

			const errors = await validate(forecast);

			if (errors.length) {
				this.logger.error(`[VALIDATION] Forecast response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return this.transformForecastDto(forecast);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch forecast data', { message: err.message, stack: err.stack });

			return null;
		}
	}

	private buildQueryParams(): string {
		switch (this.locationType) {
			case WeatherLocationTypeEnum.LAT_LON: {
				const [lat, lon] = this.location.split(' ');

				if (!lat || !lon) {
					throw new WeatherValidationException(`[WEATHER] Invalid lat/lon format: ${this.location}`);
				}

				return `lat=${lat}&lon=${lon}`;
			}
			case WeatherLocationTypeEnum.CITY_NAME: {
				return `q=${encodeURIComponent(this.location)}`;
			}
			case WeatherLocationTypeEnum.CITY_ID: {
				return `id=${this.location}`;
			}
			case WeatherLocationTypeEnum.ZIP_CODE: {
				return `zip=${this.location}`;
			}
			default: {
				throw new WeatherValidationException('Invalid location type');
			}
		}
	}

	private transformWeatherDto(dto: WeatherDto): WeatherEntity {
		return plainToInstance(
			WeatherEntity,
			{
				temperature: dto.main.temp,
				temperatureMin: dto.main.temp_min,
				temperatureMax: dto.main.temp_max,
				feelsLike: dto.main.feels_like,
				pressure: dto.main.pressure,
				humidity: dto.main.humidity,
				weather: {
					code: dto.weather[0].id,
					main: dto.weather[0].main,
					description: dto.weather[0].description,
					icon: dto.weather[0].icon,
				},
				sunrise: new Date(dto.sys.sunrise * 1000),
				sunset: new Date(dto.sys.sunset * 1000),
				location: {
					name: dto.name,
					country: dto.sys.country,
				},
				wind: {
					speed: dto.wind.speed,
					deg: dto.wind.deg,
					gust: dto.wind.gust,
				},
				clouds: dto.clouds,
				rain: dto.rain && '1h' in dto.rain ? dto.rain['1h'] : undefined,
				snow: dto.snow && '1h' in dto.snow ? dto.snow['1h'] : undefined,
				createdAt: new Date(dto.dt * 1000),
			},
			{
				excludeExtraneousValues: true,
			},
		);
	}

	private transformForecastDto(dto: ForecastDto): ForecastEntity {
		return plainToInstance(
			ForecastEntity,
			{
				location: {
					name: dto.city.name,
					country: dto.city.country,
				},
				sunrise: new Date(dto.city.sunrise * 1000),
				sunset: new Date(dto.city.sunset * 1000),
				forecast: dto.list.map((forecast) => ({
					temperature: forecast.main.temp,
					temperatureMin: forecast.main.temp_min,
					temperatureMax: forecast.main.temp_max,
					feelsLike: forecast.main.feels_like,
					pressure: forecast.main.pressure,
					humidity: forecast.main.humidity,
					weather: {
						code: forecast.weather[0].id,
						main: forecast.weather[0].main,
						description: forecast.weather[0].description,
						icon: forecast.weather[0].icon,
					},
					wind: {
						speed: forecast.wind.speed,
						deg: forecast.wind.deg,
						gust: forecast.wind.gust,
					},
					clouds: forecast.clouds,
					rain: forecast.rain && '3h' in forecast.rain ? forecast.rain['3h'] : undefined,
					snow: forecast.snow && '3h' in forecast.snow ? forecast.snow['3h'] : undefined,
					createdAt: new Date(forecast.dt * 1000),
				})),
			},
			{
				excludeExtraneousValues: true,
			},
		);
	}
}
