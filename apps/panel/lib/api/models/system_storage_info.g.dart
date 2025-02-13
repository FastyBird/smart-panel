// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_storage_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemStorageInfoImpl _$$SystemStorageInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemStorageInfoImpl(
      fs: json['fs'] as String,
      used: (json['used'] as num).toInt(),
      size: (json['size'] as num).toInt(),
      available: (json['available'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemStorageInfoImplToJson(
        _$SystemStorageInfoImpl instance) =>
    <String, dynamic>{
      'fs': instance.fs,
      'used': instance.used,
      'size': instance.size,
      'available': instance.available,
    };
