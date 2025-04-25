// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_operating_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleOperatingSystemInfoImpl
    _$$SystemModuleOperatingSystemInfoImplFromJson(Map<String, dynamic> json) =>
        _$SystemModuleOperatingSystemInfoImpl(
          platform: json['platform'] as String,
          distro: json['distro'] as String,
          release: json['release'] as String,
          uptime: (json['uptime'] as num).toInt(),
        );

Map<String, dynamic> _$$SystemModuleOperatingSystemInfoImplToJson(
        _$SystemModuleOperatingSystemInfoImpl instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'distro': instance.distro,
      'release': instance.release,
      'uptime': instance.uptime,
    };
