// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_module_location.freezed.dart';
part 'weather_module_location.g.dart';

/// Schema for the geographical location of the weather data.
@Freezed()
class WeatherModuleLocation with _$WeatherModuleLocation {
  const factory WeatherModuleLocation({
    /// Name of the city or region.
    required String name,

    /// Country code (ISO 3166-1 alpha-2) or full country name.
    required String country,
  }) = _WeatherModuleLocation;
  
  factory WeatherModuleLocation.fromJson(Map<String, Object?> json) => _$WeatherModuleLocationFromJson(json);
}
