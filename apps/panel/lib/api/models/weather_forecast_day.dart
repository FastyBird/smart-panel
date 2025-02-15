// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'feels_like.dart';
import 'temperature.dart';
import 'weather_weather.dart';
import 'weather_wind.dart';

part 'weather_forecast_day.freezed.dart';
part 'weather_forecast_day.g.dart';

/// Schema for a forecasted day, including temperature, wind, and precipitation.
@Freezed()
class WeatherForecastDay with _$WeatherForecastDay {
  const factory WeatherForecastDay({
    /// Current temperatures during the day in degrees Celsius.
    required Temperature temperature,

    /// Perceived temperatures during the day based on wind and humidity.
    @JsonKey(name: 'feels_like')
    required FeelsLike feelsLike,

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

    /// Time of data calculation
    @JsonKey(name: 'day_time')
    required DateTime dayTime,

    /// Timestamp for sunrise in ISO 8601 format.
    DateTime? sunrise,

    /// Timestamp for sunset in ISO 8601 format.
    DateTime? sunset,

    /// Timestamp for moonrise in ISO 8601 format.
    DateTime? moonrise,

    /// Timestamp for moonset in ISO 8601 format.
    DateTime? moonset,
  }) = _WeatherForecastDay;
  
  factory WeatherForecastDay.fromJson(Map<String, Object?> json) => _$WeatherForecastDayFromJson(json);
}
