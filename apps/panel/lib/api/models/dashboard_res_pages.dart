// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'dashboard_res_pages_data_union.dart';
import 'dashboard_res_pages_method.dart';

part 'dashboard_res_pages.freezed.dart';
part 'dashboard_res_pages.g.dart';

/// Response schema containing a list of pages.
@Freezed()
class DashboardResPages with _$DashboardResPages {
  const factory DashboardResPages({
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
    required DashboardResPagesMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required List<DashboardResPagesDataUnion> data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _DashboardResPages;
  
  factory DashboardResPages.fromJson(Map<String, Object?> json) => _$DashboardResPagesFromJson(json);
}
