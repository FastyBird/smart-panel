// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_channel_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleChannelControlImpl _$$DevicesModuleChannelControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleChannelControlImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      channel: json['channel'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DevicesModuleChannelControlImplToJson(
        _$DevicesModuleChannelControlImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'channel': instance.channel,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
