// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_wind.freezed.dart';
part 'weather_wind.g.dart';

/// Schema for describing the wind conditions at the specified location.
@Freezed()
class WeatherWind with _$WeatherWind {
  const factory WeatherWind({
    /// Wind speed in meters per second.
    required num speed,

    /// Wind direction in degrees (0° - 360°).
    required num deg,

    /// Wind gust speed in meters per second.
    required num? gust,
  }) = _WeatherWind;
  
  factory WeatherWind.fromJson(Map<String, Object?> json) => _$WeatherWindFromJson(json);
}
