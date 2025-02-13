// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_channel_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesChannelControlImpl _$$DevicesChannelControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesChannelControlImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      channel: json['channel'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DevicesChannelControlImplToJson(
        _$DevicesChannelControlImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'channel': instance.channel,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
