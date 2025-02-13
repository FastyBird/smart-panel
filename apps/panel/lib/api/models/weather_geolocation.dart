// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'weather_geolocation.freezed.dart';
part 'weather_geolocation.g.dart';

/// Represents geographical location details, including city name, coordinates, and country information.
@Freezed()
class WeatherGeolocation with _$WeatherGeolocation {
  const factory WeatherGeolocation({
    /// Name of the city or location.
    required String name,

    /// Alternative names for the location in different languages.
    @JsonKey(name: 'local_names')
    required Map<String, String> localNames,

    /// Latitude coordinate of the location.
    required String lat,

    /// Longitude coordinate of the location.
    required String lon,

    /// Country code (ISO 3166-1 alpha-2) or full country name.
    required String country,

    /// State or province where the location is situated, if applicable.
    required String state,
  }) = _WeatherGeolocation;
  
  factory WeatherGeolocation.fromJson(Map<String, Object?> json) => _$WeatherGeolocationFromJson(json);
}
