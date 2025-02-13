// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_res_check_username_method.dart';
import 'auth_validation.dart';
import 'common_res_metadata.dart';

part 'auth_res_check_username.freezed.dart';
part 'auth_res_check_username.g.dart';

/// Response schema indicating the result of a username validation request.
@Freezed()
class AuthResCheckUsername with _$AuthResCheckUsername {
  const factory AuthResCheckUsername({
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
    required AuthResCheckUsernameMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required AuthValidation data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _AuthResCheckUsername;
  
  factory AuthResCheckUsername.fromJson(Map<String, Object?> json) => _$AuthResCheckUsernameFromJson(json);
}
