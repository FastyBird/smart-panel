// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleSystemInfoImpl _$$SystemModuleSystemInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleSystemInfoImpl(
      cpuLoad: (json['cpu_load'] as num).toDouble(),
      memory: SystemModuleMemoryInfo.fromJson(
          json['memory'] as Map<String, dynamic>),
      storage: (json['storage'] as List<dynamic>)
          .map((e) =>
              SystemModuleStorageInfo.fromJson(e as Map<String, dynamic>))
          .toList(),
      temperature: SystemModuleTemperatureInfo.fromJson(
          json['temperature'] as Map<String, dynamic>),
      os: SystemModuleOperatingSystemInfo.fromJson(
          json['os'] as Map<String, dynamic>),
      network: (json['network'] as List<dynamic>)
          .map((e) =>
              SystemModuleNetworkStats.fromJson(e as Map<String, dynamic>))
          .toList(),
      defaultNetwork: SystemModuleDefaultNetwork.fromJson(
          json['default_network'] as Map<String, dynamic>),
      display: SystemModuleDisplayInfo.fromJson(
          json['display'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SystemModuleSystemInfoImplToJson(
        _$SystemModuleSystemInfoImpl instance) =>
    <String, dynamic>{
      'cpu_load': instance.cpuLoad,
      'memory': instance.memory,
      'storage': instance.storage,
      'temperature': instance.temperature,
      'os': instance.os,
      'network': instance.network,
      'default_network': instance.defaultNetwork,
      'display': instance.display,
    };
