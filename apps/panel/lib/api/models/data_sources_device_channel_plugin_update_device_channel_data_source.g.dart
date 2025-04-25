// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'data_sources_device_channel_plugin_update_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceImpl
    _$$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceImpl(
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic>
    _$$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceImplToJson(
            _$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceImpl
                instance) =>
        <String, dynamic>{
          'type': instance.type,
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
        };
