// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_page_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardPageDeviceChannelDataSourceImpl
    _$$DashboardPageDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardPageDeviceChannelDataSourceImpl(
          id: json['id'] as String,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          page: json['page'] as String,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic> _$$DashboardPageDeviceChannelDataSourceImplToJson(
        _$DashboardPageDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
      'page': instance.page,
      'type': instance.type,
    };
