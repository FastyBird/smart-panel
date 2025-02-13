// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_update_weather_location_type.dart';
import 'config_update_weather_type.dart';
import 'config_update_weather_unit.dart';

part 'config_update_weather.freezed.dart';
part 'config_update_weather.g.dart';

/// Schema for partial update settings for weather configuration, allowing changes to location, temperature unit, and API key.
@Freezed()
class ConfigUpdateWeather with _$ConfigUpdateWeather {
  const factory ConfigUpdateWeather({
    /// Configuration section type
    required ConfigUpdateWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    required ConfigUpdateWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    required ConfigUpdateWeatherUnit unit,

    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    String? openWeatherApiKey,
  }) = _ConfigUpdateWeather;
  
  factory ConfigUpdateWeather.fromJson(Map<String, Object?> json) => _$ConfigUpdateWeatherFromJson(json);
}
