import fetch from 'node-fetch';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { SystemConfigModel } from '../../../modules/system/models/config.model';
import { LanguageType, TemperatureUnitType } from '../../../modules/system/system.constants';
import { WeatherAlertModel } from '../../../modules/weather/models/alert.model';
import { CurrentDayModel, ForecastDayModel, LocationModel } from '../../../modules/weather/models/weather.model';
import { OpenWeatherMapOneCallLocationEntity } from '../entities/locations-openweathermap-onecall.entity';
import { OpenWeatherMapOneCallConfigModel } from '../models/config.model';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

/**
 * One Call API 3.0 response interfaces
 */
interface OneCallCurrentWeather {
	dt: number;
	sunrise: number;
	sunset: number;
	temp: number;
	feels_like: number;
	pressure: number;
	humidity: number;
	clouds: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust?: number;
	rain?: { '1h': number };
	snow?: { '1h': number };
	weather: Array<{
		id: number;
		main: string;
		description: string;
		icon: string;
	}>;
}

interface OneCallDailyWeather {
	dt: number;
	sunrise: number;
	sunset: number;
	moonrise: number;
	moonset: number;
	temp: {
		day: number;
		min: number;
		max: number;
		night: number;
		eve: number;
		morn: number;
	};
	feels_like: {
		day: number;
		night: number;
		eve: number;
		morn: number;
	};
	pressure: number;
	humidity: number;
	clouds: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust?: number;
	rain?: number;
	snow?: number;
	weather: Array<{
		id: number;
		main: string;
		description: string;
		icon: string;
	}>;
}

interface OneCallAlert {
	sender_name: string;
	event: string;
	start: number;
	end: number;
	description: string;
	tags?: string[];
}

interface OneCallResponse {
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	current?: OneCallCurrentWeather;
	daily?: OneCallDailyWeather[];
	alerts?: OneCallAlert[];
}

@Injectable()
export class OpenWeatherMapOneCallHttpService {
	private readonly logger = new Logger(OpenWeatherMapOneCallHttpService.name);

	private readonly BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';

	constructor(private readonly configService: ConfigService) {}

	async fetchWeatherData(
		location: OpenWeatherMapOneCallLocationEntity,
	): Promise<{
		current: CurrentDayModel;
		forecast: ForecastDayModel[];
		location: LocationModel;
		alerts: WeatherAlertModel[];
	} | null> {
		const config = this.getConfig();

		if (!config.apiKey) {
			this.logger.warn('[WEATHER] Missing API key for OpenWeatherMap One Call 3.0');
			return null;
		}

		const language = this.getLanguage();
		const units = this.getUnits();

		const url = `${this.BASE_URL}?lat=${location.latitude}&lon=${location.longitude}&appid=${config.apiKey}&units=${units}&lang=${language}&exclude=minutely,hourly`;

		try {
			const response = await fetch(url);
			const data = (await response.json()) as OneCallResponse | { cod?: number; message?: string };

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] One Call API request failed: ${JSON.stringify(data)}`);
				return null;
			}

			const oneCallData = data as OneCallResponse;

			const current = this.transformCurrentWeather(oneCallData.current!);
			const forecast = this.transformDailyForecast(oneCallData.daily || []);
			const alerts = this.transformAlerts(oneCallData.alerts || []);

			const locationModel = toInstance(LocationModel, {
				name: location.name,
				country: location.countryCode,
			});

			return { current, forecast, location: locationModel, alerts };
		} catch (error) {
			const err = error as Error;
			this.logger.error('[WEATHER] Failed to fetch One Call API data', { message: err.message, stack: err.stack });
			return null;
		}
	}

	async fetchAlerts(location: OpenWeatherMapOneCallLocationEntity): Promise<WeatherAlertModel[] | null> {
		const config = this.getConfig();

		if (!config.apiKey) {
			this.logger.warn('[WEATHER] Missing API key for OpenWeatherMap One Call 3.0');
			return null;
		}

		const language = this.getLanguage();

		// Only fetch alerts, exclude everything else
		const url = `${this.BASE_URL}?lat=${location.latitude}&lon=${location.longitude}&appid=${config.apiKey}&lang=${language}&exclude=current,minutely,hourly,daily`;

		try {
			const response = await fetch(url);
			const data = (await response.json()) as OneCallResponse | { cod?: number; message?: string };

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] One Call API alerts request failed: ${JSON.stringify(data)}`);
				return null;
			}

			const oneCallData = data as OneCallResponse;
			return this.transformAlerts(oneCallData.alerts || []);
		} catch (error) {
			const err = error as Error;
			this.logger.error('[WEATHER] Failed to fetch One Call API alerts', { message: err.message, stack: err.stack });
			return null;
		}
	}

	private transformCurrentWeather(current: OneCallCurrentWeather): CurrentDayModel {
		return toInstance(CurrentDayModel, {
			temperature: current.temp,
			temperatureMin: current.temp, // One Call doesn't have min/max for current, use temp
			temperatureMax: current.temp,
			feelsLike: current.feels_like,
			pressure: current.pressure,
			humidity: current.humidity,
			weather: {
				code: current.weather[0].id,
				main: current.weather[0].main,
				description: current.weather[0].description,
				icon: current.weather[0].icon,
			},
			wind: {
				speed: current.wind_speed,
				deg: current.wind_deg,
				gust: current.wind_gust,
			},
			clouds: current.clouds,
			rain: current.rain?.['1h'],
			snow: current.snow?.['1h'],
			sunrise: new Date(current.sunrise * 1000),
			sunset: new Date(current.sunset * 1000),
			dayTime: new Date(current.dt * 1000),
		});
	}

	private transformDailyForecast(daily: OneCallDailyWeather[]): ForecastDayModel[] {
		return daily.map((day) =>
			toInstance(ForecastDayModel, {
				temperature: {
					day: day.temp.day,
					min: day.temp.min,
					max: day.temp.max,
					night: day.temp.night,
					eve: day.temp.eve,
					morn: day.temp.morn,
				},
				feelsLike: {
					day: day.feels_like.day,
					night: day.feels_like.night,
					eve: day.feels_like.eve,
					morn: day.feels_like.morn,
				},
				pressure: day.pressure,
				humidity: day.humidity,
				weather: {
					code: day.weather[0].id,
					main: day.weather[0].main,
					description: day.weather[0].description,
					icon: day.weather[0].icon,
				},
				wind: {
					speed: day.wind_speed,
					deg: day.wind_deg,
					gust: day.wind_gust,
				},
				clouds: day.clouds,
				rain: day.rain,
				snow: day.snow,
				sunrise: new Date(day.sunrise * 1000),
				sunset: new Date(day.sunset * 1000),
				moonrise: new Date(day.moonrise * 1000),
				moonset: new Date(day.moonset * 1000),
				dayTime: new Date(day.dt * 1000),
			}),
		);
	}

	private transformAlerts(alerts: OneCallAlert[]): WeatherAlertModel[] {
		return alerts.map((alert) =>
			toInstance(WeatherAlertModel, {
				senderName: alert.sender_name,
				event: alert.event,
				start: new Date(alert.start * 1000),
				end: new Date(alert.end * 1000),
				description: alert.description,
				tags: alert.tags || null,
			}),
		);
	}

	private getConfig(): OpenWeatherMapOneCallConfigModel {
		try {
			return this.configService.getPluginConfig<OpenWeatherMapOneCallConfigModel>(
				WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
			);
		} catch {
			return toInstance(OpenWeatherMapOneCallConfigModel, {
				type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
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
