// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_memory_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemMemoryInfoImpl _$$SystemMemoryInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemMemoryInfoImpl(
      total: (json['total'] as num).toInt(),
      used: (json['used'] as num).toInt(),
      free: (json['free'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemMemoryInfoImplToJson(
        _$SystemMemoryInfoImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'used': instance.used,
      'free': instance.free,
    };
