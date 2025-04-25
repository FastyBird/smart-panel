// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_memory_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleMemoryInfoImpl _$$SystemModuleMemoryInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleMemoryInfoImpl(
      total: (json['total'] as num).toInt(),
      used: (json['used'] as num).toInt(),
      free: (json['free'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemModuleMemoryInfoImplToJson(
        _$SystemModuleMemoryInfoImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'used': instance.used,
      'free': instance.free,
    };
