// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_res_refresh_method.dart';
import 'auth_token_pair.dart';
import 'common_res_metadata.dart';

part 'auth_res_refresh.freezed.dart';
part 'auth_res_refresh.g.dart';

/// Response schema returned after successful user access token refresh.
@Freezed()
class AuthResRefresh with _$AuthResRefresh {
  const factory AuthResRefresh({
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
    required AuthResRefreshMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required AuthTokenPair data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _AuthResRefresh;
  
  factory AuthResRefresh.fromJson(Map<String, Object?> json) => _$AuthResRefreshFromJson(json);
}
