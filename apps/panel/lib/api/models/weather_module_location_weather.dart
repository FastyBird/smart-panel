// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'weather_module_current_day.dart';
import 'weather_module_forecast_day.dart';
import 'weather_module_location.dart';

part 'weather_module_location_weather.freezed.dart';
part 'weather_module_location_weather.g.dart';

/// Schema form current weather conditions and forecast details for a specific location.
@Freezed()
class WeatherModuleLocationWeather with _$WeatherModuleLocationWeather {
  const factory WeatherModuleLocationWeather({
    /// Current weather conditions at the specified location.
    required WeatherModuleCurrentDay current,

    /// List of daily weather forecasts.
    required List<WeatherModuleForecastDay> forecast,

    /// Details of the location where the weather data is recorded.
    required WeatherModuleLocation location,
  }) = _WeatherModuleLocationWeather;
  
  factory WeatherModuleLocationWeather.fromJson(Map<String, Object?> json) => _$WeatherModuleLocationWeatherFromJson(json);
}
