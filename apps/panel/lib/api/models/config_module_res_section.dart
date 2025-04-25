// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'config_module_res_section_data_union.dart';
import 'config_module_res_section_method.dart';

part 'config_module_res_section.freezed.dart';
part 'config_module_res_section.g.dart';

/// Response containing a specific section of the smart panel configuration, such as audio, display, language, or weather settings.
@Freezed()
class ConfigModuleResSection with _$ConfigModuleResSection {
  const factory ConfigModuleResSection({
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
    required ConfigModuleResSectionMethod method,
    required ConfigModuleResSectionDataUnion data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _ConfigModuleResSection;
  
  factory ConfigModuleResSection.fromJson(Map<String, Object?> json) => _$ConfigModuleResSectionFromJson(json);
}
