// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'common_res_metadata.dart';
import 'devices_channel_property.dart';
import 'devices_res_channel_property_method.dart';

part 'devices_res_channel_property.freezed.dart';
part 'devices_res_channel_property.g.dart';

/// Response schema containing a single channel property.
@Freezed()
class DevicesResChannelProperty with _$DevicesResChannelProperty {
  const factory DevicesResChannelProperty({
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
    required DevicesResChannelPropertyMethod method,

    /// The actual data payload returned by the API. The structure depends on the specific endpoint response.
    required DevicesChannelProperty data,

    /// Additional metadata about the request and server performance metrics.
    required CommonResMetadata metadata,
  }) = _DevicesResChannelProperty;
  
  factory DevicesResChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesResChannelPropertyFromJson(json);
}
