import { z } from 'zod';

import { type WeatherHourlyForecastSchema, WeatherForecastHourResSchema } from './weather-hourly-forecast.store.schemas';

// STORE STATE
// ===========

export type IWeatherHourlyForecast = z.infer<typeof WeatherHourlyForecastSchema>;

// BACKEND API
// ===========

export type IWeatherForecastHourRes = z.infer<typeof WeatherForecastHourResSchema>;
