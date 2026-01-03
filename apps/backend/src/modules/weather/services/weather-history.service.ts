import { FieldType, IPoint } from 'influx';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { CurrentDayModel } from '../models/weather.model';
import { WEATHER_MODULE_NAME } from '../weather.constants';

const MEASUREMENT_NAME = 'weather';

interface IWeatherHistoryPoint {
	time: Date;
	locationId: string;
	locationName: string;
	temperature: number;
	temperatureMin: number | null;
	temperatureMax: number | null;
	feelsLike: number;
	pressure: number;
	humidity: number;
	clouds: number;
	windSpeed: number;
	windDeg: number;
	windGust: number | null;
	rain: number | null;
	snow: number | null;
	weatherCode: number;
	weatherMain: string;
}

export interface IWeatherHistoryQuery {
	locationId: string;
	startTime?: Date;
	endTime?: Date;
	limit?: number;
}

@Injectable()
export class WeatherHistoryService implements OnModuleInit {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'WeatherHistoryService');

	constructor(private readonly influxDb: InfluxDbService) {}

	async onModuleInit(): Promise<void> {
		try {
			// Register schema for weather measurements
			this.influxDb.registerSchema({
				measurement: MEASUREMENT_NAME,
				fields: {
					temperature: FieldType.FLOAT,
					temperature_min: FieldType.FLOAT,
					temperature_max: FieldType.FLOAT,
					feels_like: FieldType.FLOAT,
					pressure: FieldType.INTEGER,
					humidity: FieldType.INTEGER,
					clouds: FieldType.INTEGER,
					wind_speed: FieldType.FLOAT,
					wind_deg: FieldType.INTEGER,
					wind_gust: FieldType.FLOAT,
					rain: FieldType.FLOAT,
					snow: FieldType.FLOAT,
					weather_code: FieldType.INTEGER,
				},
				tags: ['location_id', 'location_name', 'weather_main'],
			});

			// Create continuous query for aggregated data (hourly averages)
			await this.setupContinuousQueries();

			this.logger.log('Weather history schema registered');
		} catch (error) {
			const err = error as Error;
			this.logger.warn('Failed to register weather schema - InfluxDB may not be available', {
				message: err.message,
			});
		}
	}

	/**
	 * Store current weather data to InfluxDB
	 */
	async storeWeatherData(locationId: string, locationName: string, current: CurrentDayModel): Promise<void> {
		if (!this.influxDb.isConnected()) {
			return;
		}

		try {
			const point: IPoint = {
				measurement: MEASUREMENT_NAME,
				tags: {
					location_id: locationId,
					location_name: locationName,
					weather_main: current.weather.main,
				},
				fields: {
					temperature: current.temperature,
					temperature_min: current.temperatureMin ?? current.temperature,
					temperature_max: current.temperatureMax ?? current.temperature,
					feels_like: current.feelsLike,
					pressure: current.pressure,
					humidity: current.humidity,
					clouds: current.clouds,
					wind_speed: current.wind.speed,
					wind_deg: current.wind.deg,
					wind_gust: current.wind.gust ?? 0,
					rain: current.rain ?? 0,
					snow: current.snow ?? 0,
					weather_code: current.weather.code,
				},
				timestamp: current.dayTime,
			};

			await this.influxDb.writePoints([point]);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to store weather data for location=${locationId}`, {
				message: err.message,
			});
		}
	}

	/**
	 * Query historical weather data from InfluxDB
	 */
	async getHistory(query: IWeatherHistoryQuery): Promise<IWeatherHistoryPoint[]> {
		if (!this.influxDb.isConnected()) {
			return [];
		}

		try {
			const { locationId, startTime, endTime, limit = 100 } = query;

			const start = startTime ? startTime.toISOString() : 'now() - 24h';
			const end = endTime ? endTime.toISOString() : 'now()';

			const influxQuery = `
				SELECT
					temperature, temperature_min, temperature_max, feels_like,
					pressure, humidity, clouds, wind_speed, wind_deg, wind_gust,
					rain, snow, weather_code, weather_main, location_name
				FROM ${MEASUREMENT_NAME}
				WHERE location_id = '${locationId}'
				AND time >= '${start}'
				AND time <= '${end}'
				ORDER BY time DESC
				LIMIT ${limit}
			`;

			const results = await this.influxDb.query<{
				time: Date;
				temperature: number;
				temperature_min: number;
				temperature_max: number;
				feels_like: number;
				pressure: number;
				humidity: number;
				clouds: number;
				wind_speed: number;
				wind_deg: number;
				wind_gust: number;
				rain: number;
				snow: number;
				weather_code: number;
				weather_main: string;
				location_name: string;
			}>(influxQuery);

			return results.map((row) => ({
				time: row.time,
				locationId,
				locationName: row.location_name,
				temperature: row.temperature,
				temperatureMin: row.temperature_min,
				temperatureMax: row.temperature_max,
				feelsLike: row.feels_like,
				pressure: row.pressure,
				humidity: row.humidity,
				clouds: row.clouds,
				windSpeed: row.wind_speed,
				windDeg: row.wind_deg,
				windGust: row.wind_gust,
				rain: row.rain,
				snow: row.snow,
				weatherCode: row.weather_code,
				weatherMain: row.weather_main,
			}));
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to query weather history for location=${query.locationId}`, {
				message: err.message,
			});
			return [];
		}
	}

	/**
	 * Get aggregated weather statistics for a location
	 */
	async getStatistics(
		locationId: string,
		startTime?: Date,
		endTime?: Date,
	): Promise<{
		avgTemperature: number | null;
		minTemperature: number | null;
		maxTemperature: number | null;
		avgHumidity: number | null;
		avgPressure: number | null;
		totalRain: number | null;
		totalSnow: number | null;
	} | null> {
		if (!this.influxDb.isConnected()) {
			return null;
		}

		try {
			const start = startTime ? startTime.toISOString() : 'now() - 7d';
			const end = endTime ? endTime.toISOString() : 'now()';

			const influxQuery = `
				SELECT
					MEAN(temperature) as avg_temp,
					MIN(temperature_min) as min_temp,
					MAX(temperature_max) as max_temp,
					MEAN(humidity) as avg_humidity,
					MEAN(pressure) as avg_pressure,
					SUM(rain) as total_rain,
					SUM(snow) as total_snow
				FROM ${MEASUREMENT_NAME}
				WHERE location_id = '${locationId}'
				AND time >= '${start}'
				AND time <= '${end}'
			`;

			const results = await this.influxDb.query<{
				avg_temp: number;
				min_temp: number;
				max_temp: number;
				avg_humidity: number;
				avg_pressure: number;
				total_rain: number;
				total_snow: number;
			}>(influxQuery);

			if (results.length === 0) {
				return null;
			}

			const row = results[0];

			return {
				avgTemperature: row.avg_temp ?? null,
				minTemperature: row.min_temp ?? null,
				maxTemperature: row.max_temp ?? null,
				avgHumidity: row.avg_humidity ?? null,
				avgPressure: row.avg_pressure ?? null,
				totalRain: row.total_rain ?? null,
				totalSnow: row.total_snow ?? null,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to get weather statistics for location=${locationId}`, {
				message: err.message,
			});
			return null;
		}
	}

	private async setupContinuousQueries(): Promise<void> {
		try {
			// Create continuous query for hourly aggregates stored in min_14d retention policy
			await this.influxDb.createContinuousQuery(
				'cq_weather_hourly',
				`SELECT
					MEAN(temperature) as temperature,
					MIN(temperature_min) as temperature_min,
					MAX(temperature_max) as temperature_max,
					MEAN(feels_like) as feels_like,
					MEAN(pressure) as pressure,
					MEAN(humidity) as humidity,
					MEAN(clouds) as clouds,
					MEAN(wind_speed) as wind_speed,
					MEAN(wind_deg) as wind_deg,
					MAX(wind_gust) as wind_gust,
					SUM(rain) as rain,
					SUM(snow) as snow,
					LAST(weather_code) as weather_code
				INTO min_14d.${MEASUREMENT_NAME}_hourly
				FROM ${MEASUREMENT_NAME}
				GROUP BY time(1h), location_id, location_name`,
				undefined,
				'RESAMPLE EVERY 1m FOR 2h',
			);

			// Continuous queries set up successfully
		} catch (error) {
			const err = error as Error;
			this.logger.warn('Failed to set up continuous queries', { message: err.message });
		}
	}
}
