// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_default_network.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleDefaultNetworkImpl _$$SystemModuleDefaultNetworkImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleDefaultNetworkImpl(
      interfaceValue: json['interface'] as String,
      ip4: json['ip4'] as String,
      ip6: json['ip6'] as String,
      mac: json['mac'] as String,
    );

Map<String, dynamic> _$$SystemModuleDefaultNetworkImplToJson(
        _$SystemModuleDefaultNetworkImpl instance) =>
    <String, dynamic>{
      'interface': instance.interfaceValue,
      'ip4': instance.ip4,
      'ip6': instance.ip6,
      'mac': instance.mac,
    };
