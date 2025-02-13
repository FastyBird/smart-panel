// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_weather.freezed.dart';
part 'weather_weather.g.dart';

/// Schema for the current weather condition, including description and icon.
@Freezed()
class WeatherWeather with _$WeatherWeather {
  const factory WeatherWeather({
    /// Weather condition code.
    required num code,

    /// Weather condition (e.g., Rain, Snow, Clear).
    required String main,

    /// Detailed description of the weather condition.
    required String description,

    /// Icon code representing the current weather condition.
    required String icon,
  }) = _WeatherWeather;
  
  factory WeatherWeather.fromJson(Map<String, Object?> json) => _$WeatherWeatherFromJson(json);
}
