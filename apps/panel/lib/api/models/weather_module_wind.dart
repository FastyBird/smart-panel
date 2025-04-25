// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_module_wind.freezed.dart';
part 'weather_module_wind.g.dart';

/// Schema for describing the wind conditions at the specified location.
@Freezed()
class WeatherModuleWind with _$WeatherModuleWind {
  const factory WeatherModuleWind({
    /// Wind speed in meters per second.
    required num speed,

    /// Wind direction in degrees (0° - 360°).
    required num deg,

    /// Wind gust speed in meters per second.
    required num? gust,
  }) = _WeatherModuleWind;
  
  factory WeatherModuleWind.fromJson(Map<String, Object?> json) => _$WeatherModuleWindFromJson(json);
}
