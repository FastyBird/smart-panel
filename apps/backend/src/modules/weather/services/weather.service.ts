import { Cache } from 'cache-manager';
import { CronJob } from 'cron';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WeatherAlertModel } from '../models/alert.model';
import { WeatherConfigModel } from '../models/config.model';
import { CurrentDayModel, ForecastDayModel, LocationModel, LocationWeatherModel } from '../models/weather.model';
import { EventType, WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherNotFoundException, WeatherNotSupportedException } from '../weather.exceptions';

import { LocationsService } from './locations.service';
import { WeatherHistoryService } from './weather-history.service';
import { WeatherProviderRegistryService } from './weather-provider-registry.service';

@Injectable()
export class WeatherService {
	private readonly logger = new Logger(WeatherService.name);
	private readonly refreshJob: CronJob;

	private readonly CACHE_TTL = 3600000; // 1-hour cache expiration
	private readonly ALERTS_CACHE_TTL = 900000; // 15-minute cache for alerts
	private readonly CURRENT_CACHE_PREFIX = 'weather-current:';
	private readonly FORECAST_CACHE_PREFIX = 'weather-forecast:';
	private readonly ALERTS_CACHE_PREFIX = 'weather-alerts:';

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly locationsService: LocationsService,
		private readonly providerRegistry: WeatherProviderRegistryService,
		private readonly configService: ConfigService,
		private readonly eventEmitter: EventEmitter2,
		private readonly historyService: WeatherHistoryService,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
	) {
		this.refreshJob = new CronJob(CronExpression.EVERY_HOUR, async () => {
			await this.refreshAllWeather();
		});

		this.schedulerRegistry.addCronJob('refreshWeather', this.refreshJob);
		this.refreshJob.start();
	}

	/**
	 * Get weather data for all configured locations
	 */
	async getAllWeather(force = false): Promise<LocationWeatherModel[]> {
		const locations = await this.locationsService.findAll();

		if (locations.length === 0) {
			this.logger.debug('[WEATHER] No locations configured');
			return [];
		}

		const weatherResults: LocationWeatherModel[] = [];

		for (const location of locations) {
			try {
				const weather = await this.getWeatherForLocation(location, force);
				if (weather) {
					weatherResults.push(weather);
				}
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`[WEATHER] Failed to fetch weather for location=${location.id}`, {
					message: err.message,
				});
			}
		}

		return weatherResults;
	}

	/**
	 * Get the primary location ID from config
	 */
	getPrimaryLocationId(): string | null {
		try {
			const config = this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME);
			return config.primaryLocationId;
		} catch {
			return null;
		}
	}

	/**
	 * Get weather data for the primary location
	 */
	async getPrimaryWeather(force = false): Promise<LocationWeatherModel> {
		const primaryLocationId = this.getPrimaryLocationId();

		if (!primaryLocationId) {
			throw new WeatherNotFoundException('No primary location configured');
		}

		return this.getWeather(primaryLocationId, force);
	}

	/**
	 * Get weather data for a specific location by ID
	 */
	async getWeather(locationId: string, force = false): Promise<LocationWeatherModel> {
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new WeatherNotFoundException(`Location with id=${locationId} not found`);
		}

		const weather = await this.getWeatherForLocation(location, force);

		if (!weather) {
			throw new WeatherNotFoundException(`Weather data for location id=${locationId} could not be loaded`);
		}

		return weather;
	}

	/**
	 * Get current weather for a specific location
	 */
	async getCurrentWeather(locationId: string, force = false): Promise<CurrentDayModel> {
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new WeatherNotFoundException(`Location with id=${locationId} not found`);
		}

		const current = await this.fetchCurrentWeather(location, force);

		if (!current) {
			throw new WeatherNotFoundException(`Current weather for location id=${locationId} could not be loaded`);
		}

		return current.current;
	}

	/**
	 * Get forecast weather for a specific location
	 */
	async getForecastWeather(locationId: string, force = false): Promise<ForecastDayModel[]> {
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new WeatherNotFoundException(`Location with id=${locationId} not found`);
		}

		const forecast = await this.fetchForecastWeather(location, force);

		if (!forecast) {
			throw new WeatherNotFoundException(`Forecast for location id=${locationId} could not be loaded`);
		}

		return forecast;
	}

	/**
	 * Get weather alerts for a specific location
	 */
	async getAlerts(locationId: string, force = false): Promise<WeatherAlertModel[]> {
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			throw new WeatherNotFoundException(`Location with id=${locationId} not found`);
		}

		const provider = this.providerRegistry.get(location.type);

		if (!provider) {
			throw new WeatherNotFoundException(`No provider found for location type=${location.type}`);
		}

		if (!provider.supportsAlerts()) {
			throw new WeatherNotSupportedException(
				`Weather alerts are not supported by provider ${provider.getName()}. Consider using a provider with One Call API 3.0 support.`,
			);
		}

		return this.fetchAlerts(location, force);
	}

	/**
	 * Check if alerts are supported for a location
	 */
	supportsAlerts(_locationId: string): boolean {
		// This is a sync check - we need to get the location first
		// For API use, we'll provide a method that can check without async
		return false; // Default to false, actual check requires async location lookup
	}

	/**
	 * Check if alerts are supported for a location (async version)
	 */
	async checkAlertsSupported(locationId: string): Promise<boolean> {
		const location = await this.locationsService.findOne(locationId);

		if (!location) {
			return false;
		}

		const provider = this.providerRegistry.get(location.type);

		if (!provider) {
			return false;
		}

		return provider.supportsAlerts();
	}

	/**
	 * Refresh weather data for all locations
	 */
	async refreshAllWeather(): Promise<void> {
		try {
			this.logger.debug('[WEATHER] Refreshing weather data for all locations...');

			const weatherList = await this.getAllWeather(true);

			for (const weather of weatherList) {
				this.eventEmitter.emit(EventType.WEATHER_INFO, weather);
			}

			this.logger.debug(`[EVENT] Weather info broadcasted for ${weatherList.length} locations`);
		} catch (error) {
			const err = error as Error;
			this.logger.error('[EVENT] Failed to broadcast weather info', { message: err.message, stack: err.stack });
		}
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		// Configuration changes might affect providers, trigger a refresh
		this.logger.debug('[WEATHER] Config updated, scheduling weather refresh');
	}

	@OnEvent(EventType.LOCATION_CREATED)
	@OnEvent(EventType.LOCATION_UPDATED)
	async handleLocationChangedEvent(location: WeatherLocationEntity) {
		try {
			this.logger.debug(`[WEATHER] Location changed, refreshing weather for location=${location.id}`);

			// Clear cache for this location
			await this.clearLocationCache(location.id);

			// Fetch fresh weather data
			const weather = await this.getWeatherForLocation(location, true);

			if (weather) {
				this.eventEmitter.emit(EventType.WEATHER_INFO, weather);
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`[WEATHER] Failed to refresh weather after location change`, { message: err.message });
		}
	}

	@OnEvent(EventType.LOCATION_DELETED)
	async handleLocationDeletedEvent(payload: { id: string }) {
		await this.clearLocationCache(payload.id);
		this.logger.debug(`[WEATHER] Cleared cache for deleted location=${payload.id}`);
	}

	private async getWeatherForLocation(
		location: WeatherLocationEntity,
		force = false,
	): Promise<LocationWeatherModel | null> {
		const provider = this.providerRegistry.get(location.type);

		if (!provider) {
			this.logger.warn(`[WEATHER] No provider found for location type=${location.type}`);
			return null;
		}

		try {
			const [currentResult, forecast] = await Promise.all([
				this.fetchCurrentWeather(location, force),
				this.fetchForecastWeather(location, force),
			]);

			if (currentResult && forecast) {
				return toInstance(LocationWeatherModel, {
					locationId: location.id,
					current: currentResult.current,
					forecast,
					location: currentResult.location,
				});
			}

			return null;
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WEATHER] Failed to fetch weather for location=${location.id}`, {
				message: err.message,
				stack: err.stack,
			});
			return null;
		}
	}

	private async fetchCurrentWeather(
		location: WeatherLocationEntity,
		force: boolean,
	): Promise<{ current: CurrentDayModel; location: LocationModel } | null> {
		const cacheKey = `${this.CURRENT_CACHE_PREFIX}${location.id}`;

		if (!force) {
			const cached = await this.cacheManager.get<{ current: CurrentDayModel; location: LocationModel }>(cacheKey);
			if (cached) {
				this.logger.debug(`[WEATHER] Returning cached current weather for location=${location.id}`);
				return cached;
			}
		}

		const provider = this.providerRegistry.get(location.type);

		if (!provider) {
			this.logger.warn(`[WEATHER] No provider found for location type=${location.type}`);
			return null;
		}

		const current = await provider.getCurrentWeather(location);

		if (current) {
			const result = {
				current,
				location: toInstance(LocationModel, {
					name: location.name,
					country: null,
				}),
			};

			await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

			// Store to InfluxDB for historical data (async, don't wait)
			this.historyService.storeWeatherData(location.id, location.name, current).catch((err) => {
				this.logger.warn(`[WEATHER] Failed to store historical data for location=${location.id}`, {
					message: (err as Error).message,
				});
			});

			return result;
		}

		return null;
	}

	private async fetchForecastWeather(
		location: WeatherLocationEntity,
		force: boolean,
	): Promise<ForecastDayModel[] | null> {
		const cacheKey = `${this.FORECAST_CACHE_PREFIX}${location.id}`;

		if (!force) {
			const cached = await this.cacheManager.get<ForecastDayModel[]>(cacheKey);
			if (cached) {
				this.logger.debug(`[WEATHER] Returning cached forecast for location=${location.id}`);
				return cached;
			}
		}

		const provider = this.providerRegistry.get(location.type);

		if (!provider) {
			this.logger.warn(`[WEATHER] No provider found for location type=${location.type}`);
			return null;
		}

		const forecast = await provider.getForecastWeather(location);

		if (forecast) {
			await this.cacheManager.set(cacheKey, forecast, this.CACHE_TTL);
			return forecast;
		}

		return null;
	}

	private async fetchAlerts(location: WeatherLocationEntity, force: boolean): Promise<WeatherAlertModel[]> {
		const cacheKey = `${this.ALERTS_CACHE_PREFIX}${location.id}`;

		if (!force) {
			const cached = await this.cacheManager.get<WeatherAlertModel[]>(cacheKey);
			if (cached) {
				this.logger.debug(`[WEATHER] Returning cached alerts for location=${location.id}`);
				return cached;
			}
		}

		const provider = this.providerRegistry.get(location.type);

		if (!provider || !provider.supportsAlerts() || !provider.getAlerts) {
			return [];
		}

		const alerts = await provider.getAlerts(location);

		if (alerts) {
			await this.cacheManager.set(cacheKey, alerts, this.ALERTS_CACHE_TTL);
			return alerts;
		}

		return [];
	}

	private async clearLocationCache(locationId: string): Promise<void> {
		await this.cacheManager.del(`${this.CURRENT_CACHE_PREFIX}${locationId}`);
		await this.cacheManager.del(`${this.FORECAST_CACHE_PREFIX}${locationId}`);
		await this.cacheManager.del(`${this.ALERTS_CACHE_PREFIX}${locationId}`);
	}
}
