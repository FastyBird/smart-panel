// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateTileImpl _$$DashboardUpdateTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateTileImpl(
      type: json['type'] as String,
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      rowSpan: (json['row_span'] as num).toInt(),
      colSpan: (json['col_span'] as num).toInt(),
    );

Map<String, dynamic> _$$DashboardUpdateTileImplToJson(
        _$DashboardUpdateTileImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
