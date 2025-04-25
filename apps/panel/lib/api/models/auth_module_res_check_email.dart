// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_res_check_email_method.dart';
import 'auth_module_validation.dart';
import 'common_res_metadata.dart';

part 'auth_module_res_check_email.freezed.dart';
part 'auth_module_res_check_email.g.dart';

/// Response schema indicating the result of a email validation request.
@Freezed()
class AuthModuleResCheckEmail with _$AuthModuleResCheckEmail {
  const factory AuthModuleResCheckEmail({
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
    required AuthModuleResCheckEmailMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required AuthModuleValidation data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _AuthModuleResCheckEmail;
  
  factory AuthModuleResCheckEmail.fromJson(Map<String, Object?> json) => _$AuthModuleResCheckEmailFromJson(json);
}
