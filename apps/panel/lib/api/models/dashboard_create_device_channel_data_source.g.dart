// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDeviceChannelDataSourceImpl
    _$$DashboardCreateDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateDeviceChannelDataSourceImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardCreateDeviceChannelDataSourceImplToJson(
        _$DashboardCreateDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
