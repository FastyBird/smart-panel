// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tile_base_data_source_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTileBaseDataSourceUnionDeviceChannelImpl
    _$$DashboardCreateTileBaseDataSourceUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTileBaseDataSourceUnionDeviceChannelImpl(
          id: json['id'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String,
    dynamic> _$$DashboardCreateTileBaseDataSourceUnionDeviceChannelImplToJson(
        _$DashboardCreateTileBaseDataSourceUnionDeviceChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
      'type': instance.type,
    };
