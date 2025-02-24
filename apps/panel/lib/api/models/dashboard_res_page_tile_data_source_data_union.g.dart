// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tile_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTileDataSourceDataUnionDeviceChannelImpl
    _$$DashboardResPageTileDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTileDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String,
    dynamic> _$$DashboardResPageTileDataSourceDataUnionDeviceChannelImplToJson(
        _$DashboardResPageTileDataSourceDataUnionDeviceChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
      'type': instance.type,
    };
