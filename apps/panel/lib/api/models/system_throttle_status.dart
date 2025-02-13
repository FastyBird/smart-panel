// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_throttle_status.freezed.dart';
part 'system_throttle_status.g.dart';

/// Schema that indicates whether the system has encountered throttling, frequency capping, or undervoltage conditions.
@Freezed()
class SystemThrottleStatus with _$SystemThrottleStatus {
  const factory SystemThrottleStatus({
    /// Indicates if the system has detected undervoltage conditions.
    @Default(false)
    bool undervoltage,

    /// Indicates if the system is reducing CPU frequency due to power constraints.
    @JsonKey(name: 'frequency_capping')
    @Default(false)
    bool frequencyCapping,

    /// Indicates if the system has experienced CPU throttling due to high temperatures.
    @Default(false)
    bool throttling,

    /// Indicates if the system has reached the soft temperature limit and is reducing performance.
    @JsonKey(name: 'soft_temp_limit')
    @Default(false)
    bool softTempLimit,
  }) = _SystemThrottleStatus;
  
  factory SystemThrottleStatus.fromJson(Map<String, Object?> json) => _$SystemThrottleStatusFromJson(json);
}
