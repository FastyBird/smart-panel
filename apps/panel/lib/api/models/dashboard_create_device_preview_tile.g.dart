// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_device_preview_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDevicePreviewTileImpl
    _$$DashboardCreateDevicePreviewTileImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateDevicePreviewTileImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) =>
                  DashboardCreateDataSource.fromJson(e as Map<String, dynamic>))
              .toList(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardCreateDevicePreviewTileImplToJson(
        _$DashboardCreateDevicePreviewTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'device': instance.device,
      'icon': instance.icon,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
