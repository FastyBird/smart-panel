// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'weather_weather.dart';
import 'weather_wind.dart';

part 'weather_current_day.freezed.dart';
part 'weather_current_day.g.dart';

/// Schema for a specific day, including temperature, wind, and precipitation.
@Freezed()
class WeatherCurrentDay with _$WeatherCurrentDay {
  const factory WeatherCurrentDay({
    /// Current temperature in degrees Celsius.
    required num temperature,

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

    /// Timestamp for sunrise in ISO 8601 format.
    required DateTime sunrise,

    /// Timestamp for sunset in ISO 8601 format.
    required DateTime sunset,

    /// Time of data calculation
    @JsonKey(name: 'day_time')
    required DateTime dayTime,

    /// Minimum recorded temperature for the day in degrees Celsius.
    @JsonKey(name: 'temperature_min')
    num? temperatureMin,

    /// Maximum recorded temperature for the day in degrees Celsius.
    @JsonKey(name: 'temperature_max')
    num? temperatureMax,
  }) = _WeatherCurrentDay;
  
  factory WeatherCurrentDay.fromJson(Map<String, Object?> json) => _$WeatherCurrentDayFromJson(json);
}
