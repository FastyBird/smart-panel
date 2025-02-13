// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDeviceChannelDataSourceImpl
    _$$DashboardUpdateDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardUpdateDeviceChannelDataSourceImpl(
          tile: json['tile'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic> _$$DashboardUpdateDeviceChannelDataSourceImplToJson(
        _$DashboardUpdateDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'tile': instance.tile,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
      'type': instance.type,
    };
