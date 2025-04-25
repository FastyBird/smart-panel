// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'system_module_default_network.dart';
import 'system_module_display_info.dart';
import 'system_module_memory_info.dart';
import 'system_module_network_stats.dart';
import 'system_module_operating_system_info.dart';
import 'system_module_storage_info.dart';
import 'system_module_temperature_info.dart';

part 'system_module_system_info.freezed.dart';
part 'system_module_system_info.g.dart';

/// Schema for a detailed information about the system, including CPU load, memory, storage, temperature, operating system, network, and display.
@Freezed()
class SystemModuleSystemInfo with _$SystemModuleSystemInfo {
  const factory SystemModuleSystemInfo({
    /// Current CPU load percentage (0-100%).
    @JsonKey(name: 'cpu_load')
    required double cpuLoad,
    required SystemModuleMemoryInfo memory,

    /// List of available storage devices and their usage details.
    required List<SystemModuleStorageInfo> storage,
    required SystemModuleTemperatureInfo temperature,

    /// Operating system name and version.
    required SystemModuleOperatingSystemInfo os,

    /// List of network interfaces with statistics.
    required List<SystemModuleNetworkStats> network,
    @JsonKey(name: 'default_network')
    required SystemModuleDefaultNetwork defaultNetwork,
    required SystemModuleDisplayInfo display,
  }) = _SystemModuleSystemInfo;
  
  factory SystemModuleSystemInfo.fromJson(Map<String, Object?> json) => _$SystemModuleSystemInfoFromJson(json);
}
