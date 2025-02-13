// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'system_display_info.dart';
import 'system_memory_info.dart';
import 'system_network_stats.dart';
import 'system_operating_system_info.dart';
import 'system_storage_info.dart';
import 'system_temperature_info.dart';

part 'system_system_info.freezed.dart';
part 'system_system_info.g.dart';

/// Schema for a detailed information about the system, including CPU load, memory, storage, temperature, operating system, network, and display.
@Freezed()
class SystemSystemInfo with _$SystemSystemInfo {
  const factory SystemSystemInfo({
    /// Current CPU load percentage (0-100%).
    @JsonKey(name: 'cpu_load')
    required double cpuLoad,
    required SystemMemoryInfo memory,

    /// List of available storage devices and their usage details.
    required List<SystemStorageInfo> storage,
    required SystemTemperatureInfo temperature,

    /// Operating system name and version.
    required SystemOperatingSystemInfo os,

    /// List of network interfaces with statistics.
    required List<SystemNetworkStats> network,
    required SystemDisplayInfo display,
  }) = _SystemSystemInfo;
  
  factory SystemSystemInfo.fromJson(Map<String, Object?> json) => _$SystemSystemInfoFromJson(json);
}
