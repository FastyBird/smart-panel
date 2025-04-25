// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'system_module_res_system_info_method.dart';
import 'system_module_system_info.dart';

part 'system_module_res_system_info.freezed.dart';
part 'system_module_res_system_info.g.dart';

/// Response containing detailed system information, including CPU load, memory usage, storage, temperature, OS, network, and display details.
@Freezed()
class SystemModuleResSystemInfo with _$SystemModuleResSystemInfo {
  const factory SystemModuleResSystemInfo({
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
    required SystemModuleResSystemInfoMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required SystemModuleSystemInfo data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _SystemModuleResSystemInfo;
  
  factory SystemModuleResSystemInfo.fromJson(Map<String, Object?> json) => _$SystemModuleResSystemInfoFromJson(json);
}
