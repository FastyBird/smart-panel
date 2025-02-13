// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemSystemInfoImpl _$$SystemSystemInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemSystemInfoImpl(
      cpuLoad: (json['cpu_load'] as num).toDouble(),
      memory: SystemMemoryInfo.fromJson(json['memory'] as Map<String, dynamic>),
      storage: (json['storage'] as List<dynamic>)
          .map((e) => SystemStorageInfo.fromJson(e as Map<String, dynamic>))
          .toList(),
      temperature: SystemTemperatureInfo.fromJson(
          json['temperature'] as Map<String, dynamic>),
      os: SystemOperatingSystemInfo.fromJson(
          json['os'] as Map<String, dynamic>),
      network: (json['network'] as List<dynamic>)
          .map((e) => SystemNetworkStats.fromJson(e as Map<String, dynamic>))
          .toList(),
      display:
          SystemDisplayInfo.fromJson(json['display'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SystemSystemInfoImplToJson(
        _$SystemSystemInfoImpl instance) =>
    <String, dynamic>{
      'cpu_load': instance.cpuLoad,
      'memory': instance.memory,
      'storage': instance.storage,
      'temperature': instance.temperature,
      'os': instance.os,
      'network': instance.network,
      'display': instance.display,
    };
