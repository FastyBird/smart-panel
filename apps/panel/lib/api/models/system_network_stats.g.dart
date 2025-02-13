// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_network_stats.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemNetworkStatsImpl _$$SystemNetworkStatsImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemNetworkStatsImpl(
      interfaceValue: json['interface'] as String,
      rxBytes: (json['rx_bytes'] as num).toInt(),
      txBytes: (json['tx_bytes'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemNetworkStatsImplToJson(
        _$SystemNetworkStatsImpl instance) =>
    <String, dynamic>{
      'interface': instance.interfaceValue,
      'rx_bytes': instance.rxBytes,
      'tx_bytes': instance.txBytes,
    };
