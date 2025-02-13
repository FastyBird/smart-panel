// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_display_secret.dart';
import 'auth_res_register_display_method.dart';
import 'common_res_metadata.dart';

part 'auth_res_register_display.freezed.dart';
part 'auth_res_register_display.g.dart';

/// Response returned after successfully registering a display.
@Freezed()
class AuthResRegisterDisplay with _$AuthResRegisterDisplay {
  const factory AuthResRegisterDisplay({
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
    required AuthResRegisterDisplayMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required AuthDisplaySecret data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _AuthResRegisterDisplay;
  
  factory AuthResRegisterDisplay.fromJson(Map<String, Object?> json) => _$AuthResRegisterDisplayFromJson(json);
}
