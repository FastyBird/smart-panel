import { validate } from 'class-validator';
import fetch from 'node-fetch';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { SystemConfigModel } from '../../../modules/system/models/config.model';
import { LanguageType, TemperatureUnitType } from '../../../modules/system/system.constants';
import { CurrentDayModel, ForecastDayModel, LocationModel } from '../../../modules/weather/models/weather.model';
import { OpenWeatherMapForecastListItemDto, OpenWeatherMapForecastResponseDto } from '../dto/forecast-response.dto';
import { OpenWeatherMapWeatherResponseDto } from '../dto/weather-response.dto';
import { OpenWeatherMapLocationEntity } from '../entities/locations-openweathermap.entity';
import { OpenWeatherMapConfigModel } from '../models/config.model';
import { OpenWeatherMapLocationType, WEATHER_OPENWEATHERMAP_PLUGIN_NAME } from '../weather-openweathermap.constants';

@Injectable()
export class OpenWeatherMapHttpService {
	private readonly logger = new Logger(OpenWeatherMapHttpService.name);

	private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';

	constructor(private readonly configService: ConfigService) {}

	async fetchCurrentWeather(
		location: OpenWeatherMapLocationEntity,
	): Promise<{ current: CurrentDayModel; location: LocationModel } | null> {
		const config = this.getConfig();

		if (!config.apiKey) {
			this.logger.warn('[WEATHER] Missing API key for OpenWeatherMap');
			return null;
		}

		const queryParams = this.buildQueryParams(location);
		const language = this.getLanguage();
		const units = this.getUnits();

		const url = `${this.BASE_URL}/weather?${queryParams}&appid=${config.apiKey}&units=${units}&lang=${language}`;

		try {
			const response = await fetch(url);
			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] Weather API request failed: ${JSON.stringify(data)}`);
				return null;
			}

			const weather = toInstance(OpenWeatherMapWeatherResponseDto, data, { excludeExtraneousValues: false });
			const errors = await validate(weather);

			if (errors.length) {
				this.logger.error(`[VALIDATION] Weather response validation failed error=${JSON.stringify(errors)}`);
				return null;
			}

			const current = this.transformWeatherDto(weather);
			const locationModel = toInstance(LocationModel, {
				name: weather.name,
				country: weather.sys.country,
			});

			return { current, location: locationModel };
		} catch (error) {
			const err = error as Error;
			this.logger.error('[WEATHER] Failed to fetch weather data', { message: err.message, stack: err.stack });
			return null;
		}
	}

	async fetchForecastWeather(location: OpenWeatherMapLocationEntity): Promise<ForecastDayModel[] | null> {
		const config = this.getConfig();

		if (!config.apiKey) {
			this.logger.warn('[WEATHER] Missing API key for OpenWeatherMap');
			return null;
		}

		const queryParams = this.buildQueryParams(location);
		const language = this.getLanguage();
		const units = this.getUnits();

		const url = `${this.BASE_URL}/forecast?${queryParams}&appid=${config.apiKey}&units=${units}&lang=${language}`;

		try {
			const response = await fetch(url);
			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] Forecast API request failed: ${JSON.stringify(data)}`);
				return null;
			}

			const forecast = toInstance(OpenWeatherMapForecastResponseDto, data, { excludeExtraneousValues: false });
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

	private buildQueryParams(location: OpenWeatherMapLocationEntity): string {
		switch (location.locationType) {
			case OpenWeatherMapLocationType.LAT_LON: {
				if (location.latitude !== null && location.longitude !== null) {
					return `lat=${location.latitude}&lon=${location.longitude}`;
				}
				throw new Error('Invalid lat/lon configuration');
			}
			case OpenWeatherMapLocationType.CITY_NAME: {
				if (location.cityName !== null) {
					const query = location.countryCode ? `${location.cityName},${location.countryCode}` : location.cityName;
					return `q=${encodeURIComponent(query)}`;
				}
				throw new Error('Invalid city name configuration');
			}
			case OpenWeatherMapLocationType.CITY_ID: {
				if (location.cityId !== null) {
					return `id=${location.cityId}`;
				}
				throw new Error('Invalid city ID configuration');
			}
			case OpenWeatherMapLocationType.ZIP_CODE: {
				if (location.zipCode !== null) {
					return `zip=${encodeURIComponent(location.zipCode)}`;
				}
				throw new Error('Invalid ZIP code configuration');
			}
			default: {
				throw new Error('Invalid location type');
			}
		}
	}

	private transformWeatherDto(dto: OpenWeatherMapWeatherResponseDto): CurrentDayModel {
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

	private transformForecastDto(dto: OpenWeatherMapForecastResponseDto): ForecastDayModel[] {
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
				item: OpenWeatherMapForecastListItemDto;
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

	private getConfig(): OpenWeatherMapConfigModel {
		try {
			return this.configService.getPluginConfig<OpenWeatherMapConfigModel>(WEATHER_OPENWEATHERMAP_PLUGIN_NAME);
		} catch {
			return toInstance(OpenWeatherMapConfigModel, {
				type: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
				enabled: false,
				apiKey: null,
			});
		}
	}

	private getLanguage(): string {
		try {
			const systemConfig = this.configService.getModuleConfig<SystemConfigModel>('system-module');
			switch (systemConfig.language) {
				case LanguageType.ENGLISH:
					return 'en';
				case LanguageType.CZECH:
					return 'cz';
				default:
					return 'en';
			}
		} catch {
			return 'en';
		}
	}

	private getUnits(): string {
		const config = this.getConfig();
		return config.unit === TemperatureUnitType.FAHRENHEIT ? 'imperial' : 'metric';
	}
}
