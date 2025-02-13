// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_weather_location_type.dart';
import 'config_weather_type.dart';
import 'config_weather_unit.dart';

part 'config_weather.freezed.dart';
part 'config_weather.g.dart';

/// Schema for weather configuration, including location, temperature unit, and API integration.
@Freezed()
class ConfigWeather with _$ConfigWeather {
  const factory ConfigWeather({
    /// The location for weather updates, specified as a city name or coordinates (latitude, longitude).
    required String? location,

    /// API key for OpenWeatherMap. Required only if using OpenWeatherMap as a data source.
    @JsonKey(name: 'open_weather_api_key')
    required String? openWeatherApiKey,

    /// Configuration section type
    @Default(ConfigWeatherType.weather)
    ConfigWeatherType type,

    /// Specifies the method used to determine the location for weather updates.
    @JsonKey(name: 'location_type')
    @Default(ConfigWeatherLocationType.cityName)
    ConfigWeatherLocationType locationType,

    /// Defines the temperature unit for weather data.
    @Default(ConfigWeatherUnit.celsius)
    ConfigWeatherUnit unit,
  }) = _ConfigWeather;
  
  factory ConfigWeather.fromJson(Map<String, Object?> json) => _$ConfigWeatherFromJson(json);
}
