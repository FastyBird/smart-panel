// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_default_network.freezed.dart';
part 'system_default_network.g.dart';

/// Schema for a default network info, including interface, ip addresses and mac address.
@Freezed()
class SystemDefaultNetwork with _$SystemDefaultNetwork {
  const factory SystemDefaultNetwork({
    /// Network interface name.
    /// The name has been replaced because it contains a keyword. Original name: `interface`.
    @JsonKey(name: 'interface')
    required String interfaceValue,

    /// IPv4 address.
    required String ip4,

    /// IPv6 address.
    required String ip6,

    /// Default network interface physical address.
    required String mac,
  }) = _SystemDefaultNetwork;
  
  factory SystemDefaultNetwork.fromJson(Map<String, Object?> json) => _$SystemDefaultNetworkFromJson(json);
}
