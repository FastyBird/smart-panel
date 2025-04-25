// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_storage_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleStorageInfoImpl _$$SystemModuleStorageInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleStorageInfoImpl(
      fs: json['fs'] as String,
      used: (json['used'] as num).toInt(),
      size: (json['size'] as num).toInt(),
      available: (json['available'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemModuleStorageInfoImplToJson(
        _$SystemModuleStorageInfoImpl instance) =>
    <String, dynamic>{
      'fs': instance.fs,
      'used': instance.used,
      'size': instance.size,
      'available': instance.available,
    };
