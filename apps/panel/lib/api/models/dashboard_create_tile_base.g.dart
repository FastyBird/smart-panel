// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tile_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTileBaseImpl _$$DashboardCreateTileBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateTileBaseImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardCreateTileBaseImplToJson(
        _$DashboardCreateTileBaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
