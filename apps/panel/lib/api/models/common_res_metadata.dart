// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'common_res_metadata.freezed.dart';
part 'common_res_metadata.g.dart';

/// Additional metadata about the request and server performance metrics.
@Freezed()
class CommonResMetadata with _$CommonResMetadata {
  const factory CommonResMetadata({
    /// The total time taken to process the request, in milliseconds.
    @JsonKey(name: 'request_duration_ms')
    required double requestDurationMs,

    /// The server's current timestamp when the response was generated, in ISO 8601 format.
    @JsonKey(name: 'server_time')
    required DateTime serverTime,

    /// The CPU usage percentage at the time of processing the request. This can be useful for performance monitoring.
    @JsonKey(name: 'cpu_usage')
    required double cpuUsage,
  }) = _CommonResMetadata;
  
  factory CommonResMetadata.fromJson(Map<String, Object?> json) => _$CommonResMetadataFromJson(json);
}
