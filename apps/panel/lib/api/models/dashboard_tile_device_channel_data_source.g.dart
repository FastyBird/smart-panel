// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_tile_device_channel_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardTileDeviceChannelDataSourceImpl
    _$$DashboardTileDeviceChannelDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardTileDeviceChannelDataSourceImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          tile: json['tile'] as String,
        );

Map<String, dynamic> _$$DashboardTileDeviceChannelDataSourceImplToJson(
        _$DashboardTileDeviceChannelDataSourceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
      'tile': instance.tile,
    };
