// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_card_device_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCardDeviceTileImpl _$$DashboardCardDeviceTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCardDeviceTileImpl(
      id: json['id'] as String,
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardTileBaseDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      device: json['device'] as String,
      icon: json['icon'] as String?,
      card: json['card'] as String,
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'device',
    );

Map<String, dynamic> _$$DashboardCardDeviceTileImplToJson(
        _$DashboardCardDeviceTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'icon': instance.icon,
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
