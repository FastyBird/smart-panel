// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDeviceTileImpl _$$DashboardUpdateDeviceTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateDeviceTileImpl(
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      rowSpan: (json['row_span'] as num).toInt(),
      colSpan: (json['col_span'] as num).toInt(),
      device: json['device'] as String,
      icon: json['icon'] as String?,
      type: json['type'] as String? ?? 'device',
    );

Map<String, dynamic> _$$DashboardUpdateDeviceTileImplToJson(
        _$DashboardUpdateDeviceTileImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'device': instance.device,
      'icon': instance.icon,
      'type': instance.type,
    };
