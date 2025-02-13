// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'weather_weather.dart';
import 'weather_wind.dart';

part 'weather_day.freezed.dart';
part 'weather_day.g.dart';

/// Schema for a specific day, including temperature, wind, and precipitation.
@Freezed()
class WeatherDay with _$WeatherDay {
  const factory WeatherDay({
    /// Current temperature in degrees Celsius.
    required num temperature,

    /// Minimum recorded temperature for the day in degrees Celsius.
    @JsonKey(name: 'temperature_min')
    required num temperatureMin,

    /// Maximum recorded temperature for the day in degrees Celsius.
    @JsonKey(name: 'temperature_max')
    required num temperatureMax,

    /// Perceived temperature based on wind and humidity.
    @JsonKey(name: 'feels_like')
    required num feelsLike,

    /// Atmospheric pressure in hPa.
    required num pressure,

    /// Humidity level as a percentage.
    required num humidity,

    /// Detailed weather status.
    required WeatherWeather weather,

    /// Wind conditions at the location.
    required WeatherWind wind,

    /// Cloudiness percentage.
    required num clouds,

    /// Rain volume in the last hour (mm).
    required num? rain,

    /// Snow volume in the last hour (mm).
    required num? snow,

    /// Timestamp when the weather data was last updated.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,
  }) = _WeatherDay;
  
  factory WeatherDay.fromJson(Map<String, Object?> json) => _$WeatherDayFromJson(json);
}
