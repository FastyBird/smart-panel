// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tiles_time_plugin_time_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TilesTimePluginTimeTileImpl _$$TilesTimePluginTimeTileImplFromJson(
        Map<String, dynamic> json) =>
    _$TilesTimePluginTimeTileImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      parent: Parent.fromJson(json['parent'] as Map<String, dynamic>),
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) =>
              DashboardModuleDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
      hidden: json['hidden'] as bool? ?? false,
    );

Map<String, dynamic> _$$TilesTimePluginTimeTileImplToJson(
        _$TilesTimePluginTimeTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'parent': instance.parent,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'hidden': instance.hidden,
    };
