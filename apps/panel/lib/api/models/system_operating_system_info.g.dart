// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_operating_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemOperatingSystemInfoImpl _$$SystemOperatingSystemInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemOperatingSystemInfoImpl(
      platform: json['platform'] as String,
      distro: json['distro'] as String,
      release: json['release'] as String,
      uptime: (json['uptime'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemOperatingSystemInfoImplToJson(
        _$SystemOperatingSystemInfoImpl instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'distro': instance.distro,
      'release': instance.release,
      'uptime': instance.uptime,
    };
