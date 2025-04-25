// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_module_temperature_info.freezed.dart';
part 'system_module_temperature_info.g.dart';

/// Schema for the current temperature of system components like CPU and GPU.
@Freezed()
class SystemModuleTemperatureInfo with _$SystemModuleTemperatureInfo {
  const factory SystemModuleTemperatureInfo({
    /// CPU temperature in Celsius.
    int? cpu,

    /// GPU temperature in Celsius.
    int? gpu,
  }) = _SystemModuleTemperatureInfo;
  
  factory SystemModuleTemperatureInfo.fromJson(Map<String, Object?> json) => _$SystemModuleTemperatureInfoFromJson(json);
}
