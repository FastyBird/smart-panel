// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'data_sources_device_channel_plugin_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DataSourcesDeviceChannelPluginDeviceChannelDataSourceImpl
    _$$DataSourcesDeviceChannelPluginDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DataSourcesDeviceChannelPluginDeviceChannelDataSourceImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          parent: Parent2.fromJson(json['parent'] as Map<String, dynamic>),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String,
    dynamic> _$$DataSourcesDeviceChannelPluginDeviceChannelDataSourceImplToJson(
        _$DataSourcesDeviceChannelPluginDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'parent': instance.parent,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
