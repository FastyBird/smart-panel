// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_weather_location_type.dart';
import 'config_module_weather_type.dart';
import 'config_module_weather_unit.dart';

part 'config_module_weather.freezed.dart';
part 'config_module_weather.g.dart';

/// Schema for weather configuration, including location, temperature unit, and API integration.
@Freezed()
class ConfigModuleWeather with _$ConfigModuleWeather {
  const factory ConfigModuleWeather({
    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    required String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    required String? openWeatherApiKey,

    /// Configuration section type
    @Default(ConfigModuleWeatherType.weather)
    ConfigModuleWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    @Default(ConfigModuleWeatherLocationType.cityName)
    ConfigModuleWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    @Default(ConfigModuleWeatherUnit.celsius)
    ConfigModuleWeatherUnit unit,
  }) = _ConfigModuleWeather;
  
  factory ConfigModuleWeather.fromJson(Map<String, Object?> json) => _$ConfigModuleWeatherFromJson(json);
}
