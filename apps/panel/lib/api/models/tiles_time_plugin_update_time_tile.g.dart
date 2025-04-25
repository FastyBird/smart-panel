// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tiles_time_plugin_update_time_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TilesTimePluginUpdateTimeTileImpl
    _$$TilesTimePluginUpdateTimeTileImplFromJson(Map<String, dynamic> json) =>
        _$TilesTimePluginUpdateTimeTileImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          hidden: json['hidden'] as bool? ?? false,
        );

Map<String, dynamic> _$$TilesTimePluginUpdateTimeTileImplToJson(
        _$TilesTimePluginUpdateTimeTileImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'hidden': instance.hidden,
    };
