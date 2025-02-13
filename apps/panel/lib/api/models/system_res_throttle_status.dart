// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'system_res_throttle_status_method.dart';
import 'system_throttle_status.dart';

part 'system_res_throttle_status.freezed.dart';
part 'system_res_throttle_status.g.dart';

/// Response indicating whether the system has experienced any throttling, frequency capping, or undervoltage conditions.
@Freezed()
class SystemResThrottleStatus with _$SystemResThrottleStatus {
  const factory SystemResThrottleStatus({
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
    required SystemResThrottleStatusMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required SystemThrottleStatus data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _SystemResThrottleStatus;
  
  factory SystemResThrottleStatus.fromJson(Map<String, Object?> json) => _$SystemResThrottleStatusFromJson(json);
}
