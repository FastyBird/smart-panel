// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_device_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDeviceTileImpl _$$DashboardCreateDeviceTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateDeviceTileImpl(
      id: json['id'] as String,
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      rowSpan: (json['row_span'] as num).toInt(),
      colSpan: (json['col_span'] as num).toInt(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      device: json['device'] as String,
      icon: json['icon'] as String?,
      type: json['type'] as String? ?? 'device',
    );

Map<String, dynamic> _$$DashboardCreateDeviceTileImplToJson(
        _$DashboardCreateDeviceTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'device': instance.device,
      'icon': instance.icon,
      'type': instance.type,
    };
