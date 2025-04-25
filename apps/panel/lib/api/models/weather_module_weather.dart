// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_module_weather.freezed.dart';
part 'weather_module_weather.g.dart';

/// Schema for the current weather condition, including description and icon.
@Freezed()
class WeatherModuleWeather with _$WeatherModuleWeather {
  const factory WeatherModuleWeather({
    /// Weather condition code.
    required num code,

    /// Weather condition (e.g., Rain, Snow, Clear).
    required String main,

    /// Detailed description of the weather condition.
    required String description,

    /// Icon code representing the current weather condition.
    required String icon,
  }) = _WeatherModuleWeather;
  
  factory WeatherModuleWeather.fromJson(Map<String, Object?> json) => _$WeatherModuleWeatherFromJson(json);
}
