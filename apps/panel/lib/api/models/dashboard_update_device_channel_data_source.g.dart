// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDeviceChannelDataSourceImpl
    _$$DashboardUpdateDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardUpdateDeviceChannelDataSourceImpl(
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardUpdateDeviceChannelDataSourceImplToJson(
        _$DashboardUpdateDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
