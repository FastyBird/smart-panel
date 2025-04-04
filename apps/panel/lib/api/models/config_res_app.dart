// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'config_app.dart';
import 'config_res_app_method.dart';

part 'config_res_app.freezed.dart';
part 'config_res_app.g.dart';

/// Response schema containing complete configuration settings for the smart panel, including audio, display, language, and weather settings.
@Freezed()
class ConfigResApp with _$ConfigResApp {
  const factory ConfigResApp({
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
    required ConfigResAppMethod method,

    /// The configuration data for the smart panel, containing various settings.
    required ConfigApp data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _ConfigResApp;
  
  factory ConfigResApp.fromJson(Map<String, Object?> json) => _$ConfigResAppFromJson(json);
}
