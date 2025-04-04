// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_preview_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDevicePreviewTileImpl
    _$$DashboardUpdateDevicePreviewTileImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardUpdateDevicePreviewTileImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardUpdateDevicePreviewTileImplToJson(
        _$DashboardUpdateDevicePreviewTileImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'device': instance.device,
      'icon': instance.icon,
    };
