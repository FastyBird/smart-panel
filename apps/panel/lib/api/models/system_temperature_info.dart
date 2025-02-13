// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_temperature_info.freezed.dart';
part 'system_temperature_info.g.dart';

/// Schema for the current temperature of system components like CPU and GPU.
@Freezed()
class SystemTemperatureInfo with _$SystemTemperatureInfo {
  const factory SystemTemperatureInfo({
    /// CPU temperature in Celsius.
    int? cpu,

    /// GPU temperature in Celsius.
    int? gpu,
  }) = _SystemTemperatureInfo;
  
  factory SystemTemperatureInfo.fromJson(Map<String, Object?> json) => _$SystemTemperatureInfoFromJson(json);
}
