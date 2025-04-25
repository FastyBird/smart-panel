// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_network_stats.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleNetworkStatsImpl _$$SystemModuleNetworkStatsImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleNetworkStatsImpl(
      interfaceValue: json['interface'] as String,
      rxBytes: (json['rx_bytes'] as num).toInt(),
      txBytes: (json['tx_bytes'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemModuleNetworkStatsImplToJson(
        _$SystemModuleNetworkStatsImpl instance) =>
    <String, dynamic>{
      'interface': instance.interfaceValue,
      'rx_bytes': instance.rxBytes,
      'tx_bytes': instance.txBytes,
    };
