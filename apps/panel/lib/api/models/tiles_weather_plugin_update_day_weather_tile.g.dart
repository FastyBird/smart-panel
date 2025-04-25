// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tiles_weather_plugin_update_day_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TilesWeatherPluginUpdateDayWeatherTileImpl
    _$$TilesWeatherPluginUpdateDayWeatherTileImplFromJson(
            Map<String, dynamic> json) =>
        _$TilesWeatherPluginUpdateDayWeatherTileImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          hidden: json['hidden'] as bool? ?? false,
        );

Map<String, dynamic> _$$TilesWeatherPluginUpdateDayWeatherTileImplToJson(
        _$TilesWeatherPluginUpdateDayWeatherTileImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'hidden': instance.hidden,
    };
