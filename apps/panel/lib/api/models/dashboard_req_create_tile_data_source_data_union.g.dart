// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_tile_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreateTileDataSourceDataUnionDeviceChannelImpl
    _$$DashboardReqCreateTileDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateTileDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic>
    _$$DashboardReqCreateTileDataSourceDataUnionDeviceChannelImplToJson(
            _$DashboardReqCreateTileDataSourceDataUnionDeviceChannelImpl
                instance) =>
        <String, dynamic>{
          'id': instance.id,
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
          'type': instance.type,
        };
