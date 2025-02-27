// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileDataSourceDataUnionDeviceChannelImpl
    _$$DashboardResPageCardTileDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          tile: json['tile'] as String,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic>
    _$$DashboardResPageCardTileDataSourceDataUnionDeviceChannelImplToJson(
            _$DashboardResPageCardTileDataSourceDataUnionDeviceChannelImpl
                instance) =>
        <String, dynamic>{
          'id': instance.id,
          'created_at': instance.createdAt.toIso8601String(),
          'updated_at': instance.updatedAt?.toIso8601String(),
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
          'tile': instance.tile,
          'type': instance.type,
        };
