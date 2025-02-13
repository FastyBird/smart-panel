// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_time_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateTimeTileImpl _$$DashboardUpdateTimeTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateTimeTileImpl(
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      rowSpan: (json['row_span'] as num).toInt(),
      colSpan: (json['col_span'] as num).toInt(),
      type: json['type'] as String? ?? 'clock',
    );

Map<String, dynamic> _$$DashboardUpdateTimeTileImplToJson(
        _$DashboardUpdateTimeTileImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
