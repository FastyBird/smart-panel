// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_module_network_stats.freezed.dart';
part 'system_module_network_stats.g.dart';

/// Schema for a network statistics, including interface, received/transmitted bytes, and speed.
@Freezed()
class SystemModuleNetworkStats with _$SystemModuleNetworkStats {
  const factory SystemModuleNetworkStats({
    /// Network interface name.
    /// The name has been replaced because it contains a keyword. Original name: `interface`.
    @JsonKey(name: 'interface')
    required String interfaceValue,

    /// Total received bytes.
    @JsonKey(name: 'rx_bytes')
    required int rxBytes,

    /// Total transmitted bytes.
    @JsonKey(name: 'tx_bytes')
    required int txBytes,
  }) = _SystemModuleNetworkStats;
  
  factory SystemModuleNetworkStats.fromJson(Map<String, Object?> json) => _$SystemModuleNetworkStatsFromJson(json);
}
