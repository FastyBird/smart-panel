import { Cache } from 'cache-manager';
import { validate } from 'class-validator';
import { CronJob } from 'cron';
import fetch from 'node-fetch';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	EventType as ConfigModuleEventType,
	LanguageType,
	SectionType,
	TemperatureUnitType,
	WeatherLocationType,
} from '../../config/config.constants';
import { LanguageConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { ForecastDto, ForecastListItemDto } from '../dto/forecast.dto';
import { WeatherDto } from '../dto/weather.dto';
import { WeatherConfigModel } from '../models/config.model';
import { CurrentDayModel, ForecastDayModel, LocationModel, LocationWeatherModel } from '../models/weather.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { EventType } from '../weather.constants';
import { WeatherException, WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

@Injectable()
export class WeatherService {
	private readonly logger = new Logger(WeatherService.name);
	private readonly units: string;
	private readonly refreshJob: CronJob;

	private apiKey: string | null;
	private locationType: WeatherLocationType;
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

		// Load configuration lazily - will be loaded on first use
		// This avoids issues during module initialization when mappings might not be registered yet

		this.refreshJob = new CronJob(CronExpression.EVERY_DAY_AT_MIDNIGHT, async () => {
			await this.refreshWeather();
		});

		this.schedulerRegistry.addCronJob('refreshWeather', this.refreshJob);
	}

	async getWeather(force = false): Promise<LocationWeatherModel> {
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
				return toInstance(LocationWeatherModel, {
					current: current.current,
					forecast,
					location: current.location,
				});
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data or forecast could not be loaded');
	}

	async getCurrentWeather(force = false): Promise<CurrentDayModel> {
		this.loadConfiguration();

		if (this.apiKey === null) {
			this.logger.warn('[WEATHER] Missing API key for weather service');

			throw new WeatherValidationException('Api key is required');
		}

		try {
			this.logger.debug(`[WEATHER] Fetching current weather data for location='${this.location}'`);

			const current = await this.fetchCurrentWeather(force);

			if (current) {
				return toInstance(CurrentDayModel, current.current);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[WEATHER] Failed to fetch current weather data', { message: err.message, stack: err.stack });

			throw new WeatherException('An unhandled error occur. Current weather data could not be loaded');
		}

		throw new WeatherNotFoundException('Current weather data could not be loaded');
	}

	async getForecastWeather(force = false): Promise<ForecastDayModel[]> {
		this.loadConfiguration();

		if (this.apiKey === null) {
			this.logger.warn('[WEATHER] Missing API key for weather service');

			throw new WeatherValidationException('Api key is required');
		}

		try {
			this.logger.debug(`[WEATHER] Fetching current weather data for location='${this.location}'`);

			const forecast = await this.fetchWeatherForecast(force);

			if (forecast) {
				return forecast.map((day) => toInstance(ForecastDayModel, day));
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
		const config = this.getConfig();
		this.apiKey = config.openWeatherApiKey;

		this.locationType = config.locationType || WeatherLocationType.CITY_NAME;

		// Language config is still in config module (will be moved in Phase 2)
		try {
			switch (this.configService.getConfigSection(SectionType.LANGUAGE, LanguageConfigModel).language) {
				case LanguageType.ENGLISH:
					this.language = 'en';
					break;
				case LanguageType.CZECH:
					this.language = 'cz';
					break;
			}
		} catch {
			// If language config is not available, use default
			this.language = 'en';
		}

		// Start/stop refresh job based on API key availability
		if (this.apiKey !== null) {
			if (!this.refreshJob.running) {
				this.refreshJob.start();
			}
		} else if (this.refreshJob.running) {
			this.refreshJob.stop();
		}
	}

	private async fetchCurrentWeather(force: boolean = false): Promise<{
		current: CurrentDayModel;
		location: LocationModel;
	} | null> {
		const cacheKey = `weather-current:${this.location}`;
		const cachedData = await this.cacheManager.get<WeatherDto>(cacheKey);

		if (cachedData && !force) {
			this.logger.debug(`[WEATHER] Returning cached current weather data for location=${this.location}`);

			const current = this.transformWeatherDto(cachedData);

			const location = toInstance(LocationModel, {
				name: cachedData.name,
				country: cachedData.sys.country,
			});

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

			const weather = toInstance(WeatherDto, data, {
				excludeExtraneousValues: false,
			});

			const errors = await validate(weather);

			if (errors.length) {
				this.logger.error(`[VALIDATION] Weather response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			await this.cacheManager.set(cacheKey, weather, this.CACHE_TTL);

			const current = this.transformWeatherDto(weather);

			const location = toInstance(LocationModel, {
				name: weather.name,
				country: weather.sys.country,
			});

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

	private async fetchWeatherForecast(force: boolean = false): Promise<ForecastDayModel[]> {
		const cacheKey = `weather-forecast:${this.location}`;
		const cachedData = await this.cacheManager.get<WeatherDto>(cacheKey);

		if (cachedData && !force) {
			this.logger.debug(`[WEATHER] Returning cached forecast weather data for location=${this.location}`);

			const forecast = toInstance(ForecastDto, cachedData, {
				excludeExtraneousValues: false,
			});

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

			const forecast = toInstance(ForecastDto, data, {
				excludeExtraneousValues: false,
			});

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
		const config = this.getConfig();

		switch (this.locationType) {
			case WeatherLocationType.LAT_LON: {
				if (config.latitude !== null && config.longitude !== null) {
					return `lat=${config.latitude}&lon=${config.longitude}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid lat/lon configuration`);
			}
			case WeatherLocationType.CITY_NAME: {
				if (config.cityName !== null) {
					return `q=${encodeURIComponent(config.cityName)}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid city name configuration`);
			}
			case WeatherLocationType.CITY_ID: {
				if (config.cityId !== null) {
					return `id=${config.cityId}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid city ID configuration`);
			}
			case WeatherLocationType.ZIP_CODE: {
				if (config.zipCode !== null) {
					return `zip=${config.zipCode}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid ZIP code configuration`);
			}
			default: {
				throw new WeatherValidationException('Invalid location type');
			}
		}
	}

	private transformWeatherDto(dto: WeatherDto): CurrentDayModel {
		return toInstance(CurrentDayModel, {
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
		});
	}

	private transformForecastDto(dto: ForecastDto): ForecastDayModel[] {
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
			toInstance(ForecastDayModel, {
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

	private get location(): string {
		const config = this.getConfig();

		switch (this.locationType) {
			case WeatherLocationType.LAT_LON: {
				if (config.latitude !== null && config.longitude !== null) {
					return `lat=${config.latitude}:lon=${config.longitude}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid lat/lon configuration`);
			}
			case WeatherLocationType.CITY_NAME: {
				if (config.cityName !== null) {
					return `cityName=${encodeURIComponent(config.cityName)}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid city name configuration`);
			}
			case WeatherLocationType.CITY_ID: {
				if (config.cityId !== null) {
					return `cityId=${config.cityId}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid city ID configuration`);
			}
			case WeatherLocationType.ZIP_CODE: {
				if (config.zipCode !== null) {
					return `zipCode=${config.zipCode}`;
				}

				throw new WeatherValidationException(`[WEATHER] Invalid ZIP code configuration`);
			}
			default: {
				throw new WeatherValidationException('Invalid location type');
			}
		}
	}

	private getConfig(): WeatherConfigModel {
		try {
			return this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME);
		} catch (error) {
			// If config doesn't exist yet (e.g., during migration or mapping not registered), return default config
			this.logger.debug('[WEATHER] Weather module config not available, using defaults', {
				error: error instanceof Error ? error.message : String(error),
			});
			return toInstance(WeatherConfigModel, {
				type: WEATHER_MODULE_NAME,
				locationType: WeatherLocationType.LAT_LON,
				unit: TemperatureUnitType.CELSIUS,
				openWeatherApiKey: null,
				latitude: null,
				longitude: null,
				cityName: null,
				cityId: null,
				zipCode: null,
			});
		}
	}
}
