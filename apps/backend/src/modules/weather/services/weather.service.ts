import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CronJob } from 'cron';
import fetch from 'node-fetch';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import {
	EventType as ConfigModuleEventType,
	LanguageType,
	SectionType,
	WeatherLocationTypeType,
} from '../../config/config.constants';
import { LanguageConfigEntity, WeatherConfigEntity } from '../../config/entities/config.entity';
import { ConfigService } from '../../config/services/config.service';
import { ForecastDto, ForecastListItemDto } from '../dto/forecast.dto';
import { WeatherDto } from '../dto/weather.dto';
import { CurrentDayEntity, ForecastDayEntity, LocationEntity, LocationWeatherEntity } from '../entities/weather.entity';
import { EventType } from '../weather.constants';
import { WeatherException, WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@Injectable()
export class WeatherService {
	private readonly logger = new Logger(WeatherService.name);
	private readonly units: string;
	private readonly refreshJob: CronJob;

	private apiKey: string | null;
	private location: string;
	private locationType: WeatherLocationTypeType;
	private language: string = 'en';

	private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';
	private readonly CACHE_TTL = 3600000; // 1-hour cache expiration

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly configService: ConfigService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {
		this.units = 'metric';

		this.loadConfiguration();

		this.refreshJob = new CronJob(CronExpression.EVERY_DAY_AT_MIDNIGHT, async () => {
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

		try {
			this.logger.debug(`[WEATHER] Fetching weather data for location='${this.location}'`);

			const [current, forecast] = await Promise.all([
				this.fetchCurrentWeather(force),
				this.fetchWeatherForecast(force),
			]);

			if (current && forecast) {
				return plainToInstance(
					LocationWeatherEntity,
					{
						current: current.current,
						forecast,
						location: current.location,
					},
					{
						excludeExtraneousValues: true,
					},
				);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data or forecast could not be loaded');
	}

	async getCurrentWeather(force = false): Promise<CurrentDayEntity> {
		this.loadConfiguration();

		if (this.apiKey === null) {
			this.logger.warn('[WEATHER] Missing API key for weather service');

			throw new WeatherValidationException('Api key is required');
		}

		try {
			this.logger.debug(`[WEATHER] Fetching current weather data for location='${this.location}'`);

			const current = await this.fetchCurrentWeather(force);

			if (current) {
				return plainToInstance(CurrentDayEntity, current.current, {
					excludeExtraneousValues: true,
				});
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch current weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Current weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data could not be loaded');
	}

	async getForecastWeather(force = false): Promise<ForecastDayEntity[]> {
		this.loadConfiguration();

		if (this.apiKey === null) {
			this.logger.warn('[WEATHER] Missing API key for weather service');

			throw new WeatherValidationException('Api key is required');
		}

		try {
			this.logger.debug(`[WEATHER] Fetching current weather data for location='${this.location}'`);

			const forecast = await this.fetchWeatherForecast(force);

			if (forecast) {
				return forecast.map((day) =>
					plainToInstance(ForecastDayEntity, day, {
						excludeExtraneousValues: true,
					}),
				);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch current weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Current weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data could not be loaded');
	}

	async refreshWeather(): Promise<void> {
		try {
			this.logger.debug('[WEATHER] Refreshing weather data...');

			const weather = await this.getWeather(true);

			this.eventEmitter.emit(EventType.WEATHER_INFO, weather);

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
		this.apiKey = this.configService.getConfigSection(SectionType.WEATHER, WeatherConfigEntity).openWeatherApiKey;

		this.location =
			this.configService.getConfigSection(SectionType.WEATHER, WeatherConfigEntity).location || 'Prague,CZ';

		this.locationType =
			this.configService.getConfigSection(SectionType.WEATHER, WeatherConfigEntity).locationType ||
			WeatherLocationTypeType.CITY_NAME;

		switch (this.configService.getConfigSection(SectionType.LANGUAGE, LanguageConfigEntity).language) {
			case LanguageType.ENGLISH:
				this.language = 'en';
				break;
			case LanguageType.CZECH:
				this.language = 'cz';
				break;
		}
	}

	private async fetchCurrentWeather(force: boolean = false): Promise<{
		current: CurrentDayEntity;
		location: LocationEntity;
	} | null> {
		const cacheKey = `weather-current:${this.location}`;
		const cachedData = await this.cacheManager.get<WeatherDto>(cacheKey);

		if (cachedData && !force) {
			this.logger.debug(`[WEATHER] Returning cached current weather data for location=${this.location}`);

			const current = this.transformWeatherDto(cachedData);

			const location = plainToInstance(
				LocationEntity,
				{
					name: cachedData.name,
					country: cachedData.sys.country,
				},
				{
					excludeExtraneousValues: true,
				},
			);

			return {
				current,
				location,
			};
		}

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

			await this.cacheManager.set(cacheKey, weather, this.CACHE_TTL);

			const current = this.transformWeatherDto(weather);

			const location = plainToInstance(
				LocationEntity,
				{
					name: weather.name,
					country: weather.sys.country,
				},
				{
					excludeExtraneousValues: true,
				},
			);

			return {
				current,
				location,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });

			return null;
		}
	}

	private async fetchWeatherForecast(force: boolean = false): Promise<ForecastDayEntity[]> {
		const cacheKey = `weather-forecast:${this.location}`;
		const cachedData = await this.cacheManager.get<WeatherDto>(cacheKey);

		if (cachedData && !force) {
			this.logger.debug(`[WEATHER] Returning cached forecast weather data for location=${this.location}`);

			const forecast = plainToInstance(ForecastDto, cachedData, { excludeExtraneousValues: true });

			const errors = await validate(forecast);

			if (errors.length) {
				this.logger.error(`[VALIDATION] Cached forecast response validation failed error=${JSON.stringify(errors)}`);

				return null;
			} else {
				return this.transformForecastDto(forecast);
			}
		}

		const queryParams = this.buildQueryParams();

		const url = `${this.BASE_URL}/forecast?${queryParams}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;

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

			await this.cacheManager.set(cacheKey, forecast, this.CACHE_TTL);

			return this.transformForecastDto(forecast);
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch forecast data', { message: err.message, stack: err.stack });

			return null;
		}
	}

	private buildQueryParams(): string {
		switch (this.locationType) {
			case WeatherLocationTypeType.LAT_LON: {
				const [lat, lon] = this.location.split(' ');

				if (!lat || !lon) {
					throw new WeatherValidationException(`[WEATHER] Invalid lat/lon format: ${this.location}`);
				}

				return `lat=${lat}&lon=${lon}`;
			}
			case WeatherLocationTypeType.CITY_NAME: {
				return `q=${encodeURIComponent(this.location)}`;
			}
			case WeatherLocationTypeType.CITY_ID: {
				return `id=${this.location}`;
			}
			case WeatherLocationTypeType.ZIP_CODE: {
				return `zip=${this.location}`;
			}
			default: {
				throw new WeatherValidationException('Invalid location type');
			}
		}
	}

	private transformWeatherDto(dto: WeatherDto): CurrentDayEntity {
		return plainToInstance(
			CurrentDayEntity,
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
				wind: {
					speed: dto.wind.speed,
					deg: dto.wind.deg,
					gust: dto.wind.gust,
				},
				clouds: dto.clouds.all,
				rain: dto.rain && '1h' in dto.rain ? dto.rain['1h'] : undefined,
				snow: dto.snow && '1h' in dto.snow ? dto.snow['1h'] : undefined,
				sunrise: new Date(dto.sys.sunrise * 1000),
				sunset: new Date(dto.sys.sunset * 1000),
				dayTime: new Date(dto.dt * 1000),
			},
			{
				excludeExtraneousValues: true,
			},
		);
	}

	private transformForecastDto(dto: ForecastDto): ForecastDayEntity[] {
		const dailyData: Record<
			string,
			{
				temps: number[];
				feels_like: number[];
				segments: {
					morn: number[];
					day: number[];
					eve: number[];
					night: number[];
				};
				item: ForecastListItemDto;
			}
		> = {};

		dto.list.forEach((entry) => {
			const dt = new Date(entry.dt * 1000);
			const dayStr = dt.toISOString().split('T')[0];

			if (!dailyData[dayStr]) {
				dailyData[dayStr] = {
					temps: [],
					feels_like: [],
					segments: {
						morn: [],
						day: [],
						eve: [],
						night: [],
					},
					item: entry,
				};
			}

			const hour = dt.getUTCHours();

			let partOfDay: keyof (typeof dailyData)[string]['segments'];

			if (hour >= 6 && hour < 12) {
				partOfDay = 'morn';
			} else if (hour >= 12 && hour < 18) {
				partOfDay = 'day';
			} else if (hour >= 18 && hour < 20) {
				partOfDay = 'eve';
			} else {
				partOfDay = 'night';
			}

			// Store values
			dailyData[dayStr].temps.push(entry.main.temp);
			dailyData[dayStr].feels_like.push(entry.main.feels_like);
			dailyData[dayStr].segments[partOfDay].push(entry.main.temp);
		});

		return Object.entries(dailyData).map(([date, data]) =>
			//return dto.list.map((forecast) =>
			plainToInstance(ForecastDayEntity, {
				temperature: {
					day: this.average(data.segments.day),
					min: Math.min(...data.temps),
					max: Math.max(...data.temps),
					night: this.average(data.segments.night),
					eve: this.average(data.segments.eve),
					morn: this.average(data.segments.morn),
				},
				feelsLike: {
					day: this.average(data.segments.day),
					night: this.average(data.segments.night),
					eve: this.average(data.segments.eve),
					morn: this.average(data.segments.morn),
				},
				pressure: data.item.main.pressure,
				humidity: data.item.main.humidity,
				weather: {
					code: data.item.weather[0].id,
					main: data.item.weather[0].main,
					description: data.item.weather[0].description,
					icon: data.item.weather[0].icon,
				},
				wind: {
					speed: data.item.wind.speed,
					deg: data.item.wind.deg,
					gust: data.item.wind.gust,
				},
				clouds: data.item.clouds.all,
				rain: data.item.rain && '3h' in data.item.rain ? data.item.rain['3h'] : undefined,
				snow: data.item.snow && '3h' in data.item.snow ? data.item.snow['3h'] : undefined,
				sunrise: undefined,
				sunset: undefined,
				moonrise: undefined,
				moonset: undefined,
				dayTime: new Date(date),
			}),
		);
	}

	private average(values: number[]): number | undefined {
		return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : undefined;
	}
}
