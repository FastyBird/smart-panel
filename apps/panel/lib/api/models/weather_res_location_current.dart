// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'weather_current_day.dart';
import 'weather_res_location_current_method.dart';

part 'weather_res_location_current.freezed.dart';
part 'weather_res_location_current.g.dart';

/// Response containing detailed weather conditions for a current day and for a specified location.
@Freezed()
class WeatherResLocationCurrent with _$WeatherResLocationCurrent {
  const factory WeatherResLocationCurrent({
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
    required WeatherResLocationCurrentMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required WeatherCurrentDay data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _WeatherResLocationCurrent;
  
  factory WeatherResLocationCurrent.fromJson(Map<String, Object?> json) => _$WeatherResLocationCurrentFromJson(json);
}
