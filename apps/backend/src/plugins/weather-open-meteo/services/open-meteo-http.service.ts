import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { SystemConfigModel } from '../../../modules/system/models/config.model';
import { LanguageType, TemperatureUnitType } from '../../../modules/system/system.constants';
import { CurrentDayModel, ForecastDayModel, LocationModel } from '../../../modules/weather/models/weather.model';
import { OpenMeteoCurrentDto, OpenMeteoDailyDto, OpenMeteoResponseDto } from '../dto/open-meteo-response.dto';
import { OpenMeteoLocationEntity } from '../entities/locations-open-meteo.entity';
import { OpenMeteoConfigModel } from '../models/config.model';
import { WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

/**
 * WMO Weather interpretation codes mapping to OpenWeatherMap-compatible format.
 * https://open-meteo.com/en/docs#weathervariables
 */
interface WmoMapping {
	main: string;
	description: string;
	icon: string;
	iconNight: string;
}

const WMO_CODE_MAP: Record<number, WmoMapping> = {
	0: { main: 'Clear', description: 'clear sky', icon: '01d', iconNight: '01n' },
	1: { main: 'Clear', description: 'mainly clear', icon: '01d', iconNight: '01n' },
	2: { main: 'Clouds', description: 'partly cloudy', icon: '02d', iconNight: '02n' },
	3: { main: 'Clouds', description: 'overcast', icon: '04d', iconNight: '04n' },
	45: { main: 'Fog', description: 'fog', icon: '50d', iconNight: '50n' },
	48: { main: 'Fog', description: 'depositing rime fog', icon: '50d', iconNight: '50n' },
	51: { main: 'Drizzle', description: 'light drizzle', icon: '09d', iconNight: '09n' },
	53: { main: 'Drizzle', description: 'moderate drizzle', icon: '09d', iconNight: '09n' },
	55: { main: 'Drizzle', description: 'dense drizzle', icon: '09d', iconNight: '09n' },
	56: { main: 'Drizzle', description: 'light freezing drizzle', icon: '09d', iconNight: '09n' },
	57: { main: 'Drizzle', description: 'dense freezing drizzle', icon: '09d', iconNight: '09n' },
	61: { main: 'Rain', description: 'slight rain', icon: '10d', iconNight: '10n' },
	63: { main: 'Rain', description: 'moderate rain', icon: '10d', iconNight: '10n' },
	65: { main: 'Rain', description: 'heavy rain', icon: '10d', iconNight: '10n' },
	66: { main: 'Rain', description: 'light freezing rain', icon: '13d', iconNight: '13n' },
	67: { main: 'Rain', description: 'heavy freezing rain', icon: '13d', iconNight: '13n' },
	71: { main: 'Snow', description: 'slight snow fall', icon: '13d', iconNight: '13n' },
	73: { main: 'Snow', description: 'moderate snow fall', icon: '13d', iconNight: '13n' },
	75: { main: 'Snow', description: 'heavy snow fall', icon: '13d', iconNight: '13n' },
	77: { main: 'Snow', description: 'snow grains', icon: '13d', iconNight: '13n' },
	80: { main: 'Rain', description: 'slight rain showers', icon: '09d', iconNight: '09n' },
	81: { main: 'Rain', description: 'moderate rain showers', icon: '09d', iconNight: '09n' },
	82: { main: 'Rain', description: 'violent rain showers', icon: '09d', iconNight: '09n' },
	85: { main: 'Snow', description: 'slight snow showers', icon: '13d', iconNight: '13n' },
	86: { main: 'Snow', description: 'heavy snow showers', icon: '13d', iconNight: '13n' },
	95: { main: 'Thunderstorm', description: 'thunderstorm', icon: '11d', iconNight: '11n' },
	96: { main: 'Thunderstorm', description: 'thunderstorm with slight hail', icon: '11d', iconNight: '11n' },
	99: { main: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '11d', iconNight: '11n' },
};

const CZECH_WMO_DESCRIPTION_MAP: Record<number, string> = {
	0: 'jasno',
	1: 'převážně jasno',
	2: 'polojasno',
	3: 'zataženo',
	45: 'mlha',
	48: 'namrzající mlha',
	51: 'slabé mrholení',
	53: 'mrholení',
	55: 'silné mrholení',
	56: 'slabé mrznoucí mrholení',
	57: 'silné mrznoucí mrholení',
	61: 'slabý déšť',
	63: 'déšť',
	65: 'silný déšť',
	66: 'slabý mrznoucí déšť',
	67: 'silný mrznoucí déšť',
	71: 'slabé sněžení',
	73: 'sněžení',
	75: 'silné sněžení',
	77: 'sněhové krupky',
	80: 'slabé přeháňky',
	81: 'přeháňky',
	82: 'silné přeháňky',
	85: 'slabé sněhové přeháňky',
	86: 'silné sněhové přeháňky',
	95: 'bouřka',
	96: 'bouřka se slabým krupobitím',
	99: 'bouřka se silným krupobitím',
};

/**
 * Map WMO code to OpenWeatherMap-compatible code ranges for compatibility.
 */
function wmoToOwmCode(wmoCode: number): number {
	switch (wmoCode) {
		case 0:
		case 1:
			return 800; // Clear
		case 2:
			return 802; // Scattered clouds
		case 3:
			return 804; // Overcast
		case 45:
		case 48:
			return 741; // Fog
		case 51:
		case 53:
		case 55:
		case 56:
		case 57:
			return 300; // Drizzle
		case 61:
		case 80:
			return 500; // Light rain
		case 63:
		case 81:
			return 501; // Moderate rain
		case 65:
		case 82:
			return 502; // Heavy rain
		case 66:
		case 67:
			return 511; // Freezing rain
		case 71:
		case 85:
			return 600; // Light snow
		case 73:
			return 601; // Snow
		case 75:
		case 77:
		case 86:
			return 602; // Heavy snow
		case 95:
		case 96:
		case 99:
			return 200; // Thunderstorm
		default:
			return 800;
	}
}

/**
 * Parse an offset-less date/time string from Open-Meteo as if it were in the given IANA timezone.
 * Open-Meteo with `timezone=auto` returns local times without offset (e.g. "2024-01-15T07:15").
 * `new Date()` would incorrectly interpret these in the server's timezone.
 */
function parseLocalDate(dateStr: string, timezone: string): Date {
	// Use Intl to find the UTC offset for the given timezone at the approximate time
	const naive = new Date(dateStr + 'Z'); // treat as UTC temporarily to get a reference point

	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	});

	// Format the naive UTC date in the target timezone to find the offset
	const parts = formatter.formatToParts(naive);
	const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';

	const tzYear = parseInt(get('year'), 10);
	const tzMonth = parseInt(get('month'), 10) - 1;
	const tzDay = parseInt(get('day'), 10);
	const tzHour = parseInt(get('hour'), 10);
	const tzMinute = parseInt(get('minute'), 10);
	const tzSecond = parseInt(get('second'), 10);

	// What the timezone thinks naive UTC is in local time
	const localAtUtc = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond));
	// The offset is the difference: localAtUtc - naive
	const offsetMs = localAtUtc.getTime() - naive.getTime();

	// The actual UTC time is the naive time minus the offset
	return new Date(naive.getTime() - offsetMs);
}

@Injectable()
export class OpenMeteoHttpService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		WEATHER_OPEN_METEO_PLUGIN_NAME,
		'OpenMeteoHttpService',
	);

	private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

	constructor(private readonly configService: ConfigService) {}

	async fetchWeatherData(location: OpenMeteoLocationEntity): Promise<{
		current: CurrentDayModel;
		forecast: ForecastDayModel[];
		location: LocationModel;
	} | null> {
		const temperatureUnit = this.getUnits();
		const windSpeedUnit = 'ms'; // WindModel expects m/s regardless of temperature unit

		const currentParams = [
			'temperature_2m',
			'apparent_temperature',
			'relative_humidity_2m',
			'surface_pressure',
			'wind_speed_10m',
			'wind_direction_10m',
			'wind_gusts_10m',
			'cloud_cover',
			'rain',
			'snowfall',
			'weather_code',
			'is_day',
		].join(',');

		const dailyParams = [
			'weather_code',
			'temperature_2m_max',
			'temperature_2m_min',
			'apparent_temperature_max',
			'apparent_temperature_min',
			'sunrise',
			'sunset',
			'rain_sum',
			'snowfall_sum',
			'wind_speed_10m_max',
			'wind_direction_10m_dominant',
			'wind_gusts_10m_max',
			'pressure_msl_max',
			'relative_humidity_2m_mean',
			'cloud_cover_mean',
		].join(',');

		const url =
			`${this.BASE_URL}?latitude=${location.latitude}&longitude=${location.longitude}` +
			`&current=${currentParams}&daily=${dailyParams}` +
			`&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}` +
			`&timezone=auto&forecast_days=7`;

		try {
			const response = await fetch(url);
			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error(`[WEATHER] Open-Meteo API request failed: ${JSON.stringify(data)}`);
				return null;
			}

			const openMeteoData = data as OpenMeteoResponseDto;

			if (!openMeteoData.current || !openMeteoData.daily) {
				this.logger.error('[WEATHER] Open-Meteo API response missing current or daily data');
				return null;
			}

			const timezone = openMeteoData.timezone ?? 'UTC';
			const current = this.transformCurrentWeather(openMeteoData.current, openMeteoData.daily, timezone);
			const forecast = this.transformDailyForecast(openMeteoData.daily, timezone);

			const locationModel = toInstance(LocationModel, {
				name: location.name,
				country: location.countryCode,
			});

			return { current, forecast, location: locationModel };
		} catch (error) {
			const err = error as Error;
			this.logger.error('[WEATHER] Failed to fetch Open-Meteo data', { message: err.message, stack: err.stack });
			return null;
		}
	}

	private transformCurrentWeather(
		current: OpenMeteoCurrentDto,
		daily: OpenMeteoDailyDto,
		timezone: string,
	): CurrentDayModel {
		const wmoCode = current.weather_code;
		const mapping = WMO_CODE_MAP[wmoCode] ?? WMO_CODE_MAP[0];
		const isDay = current.is_day === 1;
		const icon = isDay ? mapping.icon : mapping.iconNight;

		// Get today's sunrise/sunset from daily data
		const todaySunrise = daily.sunrise?.[0] ? parseLocalDate(daily.sunrise[0], timezone) : new Date();
		const todaySunset = daily.sunset?.[0] ? parseLocalDate(daily.sunset[0], timezone) : new Date();

		// Get today's min/max from daily data
		const todayMin = daily.temperature_2m_min?.[0] ?? current.temperature_2m;
		const todayMax = daily.temperature_2m_max?.[0] ?? current.temperature_2m;

		return toInstance(CurrentDayModel, {
			temperature: current.temperature_2m,
			temperatureMin: todayMin,
			temperatureMax: todayMax,
			feelsLike: current.apparent_temperature,
			pressure: current.surface_pressure,
			humidity: current.relative_humidity_2m,
			weather: {
				code: wmoToOwmCode(wmoCode),
				main: mapping.main,
				description: this.getLocalizedDescription(wmoCode, mapping),
				icon,
			},
			wind: {
				speed: current.wind_speed_10m,
				deg: current.wind_direction_10m,
				gust: current.wind_gusts_10m ?? null,
			},
			clouds: current.cloud_cover,
			rain: current.rain ?? null,
			snow: current.snowfall ?? null,
			sunrise: todaySunrise,
			sunset: todaySunset,
			dayTime: parseLocalDate(current.time, timezone),
		});
	}

	private transformDailyForecast(daily: OpenMeteoDailyDto, timezone: string): ForecastDayModel[] {
		const days: ForecastDayModel[] = [];

		for (let i = 0; i < daily.time.length; i++) {
			const wmoCode = daily.weather_code[i];
			const mapping = WMO_CODE_MAP[wmoCode] ?? WMO_CODE_MAP[0];

			const tempMin = daily.temperature_2m_min[i];
			const tempMax = daily.temperature_2m_max[i];
			const tempAvg = (tempMin + tempMax) / 2;

			const feelsLikeMax = daily.apparent_temperature_max[i];
			const feelsLikeMin = daily.apparent_temperature_min[i];
			const feelsLikeAvg = (feelsLikeMax + feelsLikeMin) / 2;

			days.push(
				toInstance(ForecastDayModel, {
					temperature: {
						day: tempAvg,
						min: tempMin,
						max: tempMax,
						night: tempMin,
						eve: tempAvg,
						morn: tempMin,
					},
					feelsLike: {
						day: feelsLikeAvg,
						night: feelsLikeMin,
						eve: feelsLikeAvg,
						morn: feelsLikeMin,
					},
					pressure: daily.pressure_msl_max[i],
					humidity: daily.relative_humidity_2m_mean[i],
					weather: {
						code: wmoToOwmCode(wmoCode),
						main: mapping.main,
						description: this.getLocalizedDescription(wmoCode, mapping),
						icon: mapping.icon,
					},
					wind: {
						speed: daily.wind_speed_10m_max[i],
						deg: daily.wind_direction_10m_dominant[i],
						gust: daily.wind_gusts_10m_max?.[i] ?? null,
					},
					clouds: daily.cloud_cover_mean[i],
					rain: daily.rain_sum?.[i] ?? null,
					snow: daily.snowfall_sum?.[i] ?? null,
					sunrise: parseLocalDate(daily.sunrise[i], timezone),
					sunset: parseLocalDate(daily.sunset[i], timezone),
					dayTime: parseLocalDate(daily.time[i] + 'T12:00:00', timezone),
				}),
			);
		}

		return days;
	}

	private getLocalizedDescription(wmoCode: number, mapping: WmoMapping): string {
		const language = this.getLanguage();

		if (language === 'cs') {
			return this.getCzechDescription(wmoCode) ?? mapping.description;
		}

		return mapping.description;
	}

	private getCzechDescription(wmoCode: number): string | null {
		return CZECH_WMO_DESCRIPTION_MAP[wmoCode] ?? null;
	}

	private getConfig(): OpenMeteoConfigModel {
		try {
			return this.configService.getPluginConfig<OpenMeteoConfigModel>(WEATHER_OPEN_METEO_PLUGIN_NAME);
		} catch {
			return toInstance(OpenMeteoConfigModel, {
				type: WEATHER_OPEN_METEO_PLUGIN_NAME,
				enabled: true,
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
					return 'cs';
				default:
					return 'en';
			}
		} catch {
			return 'en';
		}
	}

	private getUnits(): string {
		const config = this.getConfig();
		return config.unit === TemperatureUnitType.FAHRENHEIT ? 'fahrenheit' : 'celsius';
	}
}
