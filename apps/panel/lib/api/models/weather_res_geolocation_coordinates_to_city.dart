// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'weather_geolocation.dart';
import 'weather_res_geolocation_coordinates_to_city_method.dart';

part 'weather_res_geolocation_coordinates_to_city.freezed.dart';
part 'weather_res_geolocation_coordinates_to_city.g.dart';

/// Response providing city details for a given latitude and longitude.
@Freezed()
class WeatherResGeolocationCoordinatesToCity with _$WeatherResGeolocationCoordinatesToCity {
  const factory WeatherResGeolocationCoordinatesToCity({
    /// Indicates whether the API request was successful (`success`) or encountered an error (`error`).
    required String status,

    /// Timestamp when the response was generated, in ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`).
    required DateTime timestamp,

    /// A unique identifier assigned to this API request. Useful for debugging and tracking API calls.
    @JsonKey(name: 'request_id')
    required String requestId,

    /// The API endpoint that was requested, including any dynamic parameters.
    required String path,

    /// The HTTP method used for the request (`GET`, `POST`, `PATCH`, `DELETE`).
    required WeatherResGeolocationCoordinatesToCityMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required WeatherGeolocation data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _WeatherResGeolocationCoordinatesToCity;
  
  factory WeatherResGeolocationCoordinatesToCity.fromJson(Map<String, Object?> json) => _$WeatherResGeolocationCoordinatesToCityFromJson(json);
}
