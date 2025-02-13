// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'weather_day.dart';
import 'weather_location.dart';

part 'weather_location_weather.freezed.dart';
part 'weather_location_weather.g.dart';

/// Schema form current weather conditions and forecast details for a specific location.
@Freezed()
class WeatherLocationWeather with _$WeatherLocationWeather {
  const factory WeatherLocationWeather({
    /// Current weather conditions at the specified location.
    required WeatherDay current,

    /// List of daily weather forecasts.
    required List<WeatherDay> forecast,

    /// Details of the location where the weather data is recorded.
    required WeatherLocation location,

    /// Timestamp for sunrise in ISO 8601 format.
    required DateTime sunrise,

    /// Timestamp for sunset in ISO 8601 format.
    required DateTime sunset,

    /// Timestamp when the weather data was last updated.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,
  }) = _WeatherLocationWeather;
  
  factory WeatherLocationWeather.fromJson(Map<String, Object?> json) => _$WeatherLocationWeatherFromJson(json);
}
