// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'weather_current_day.dart';
import 'weather_forecast_day.dart';
import 'weather_location.dart';

part 'weather_location_weather.freezed.dart';
part 'weather_location_weather.g.dart';

/// Schema form current weather conditions and forecast details for a specific location.
@Freezed()
class WeatherLocationWeather with _$WeatherLocationWeather {
  const factory WeatherLocationWeather({
    /// Current weather conditions at the specified location.
    required WeatherCurrentDay current,

    /// List of daily weather forecasts.
    required List<WeatherForecastDay> forecast,

    /// Details of the location where the weather data is recorded.
    required WeatherLocation location,
  }) = _WeatherLocationWeather;
  
  factory WeatherLocationWeather.fromJson(Map<String, Object?> json) => _$WeatherLocationWeatherFromJson(json);
}
