// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tiles_weather_plugin_update_forecast_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TilesWeatherPluginUpdateForecastWeatherTileImpl
    _$$TilesWeatherPluginUpdateForecastWeatherTileImplFromJson(
            Map<String, dynamic> json) =>
        _$TilesWeatherPluginUpdateForecastWeatherTileImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          hidden: json['hidden'] as bool? ?? false,
        );

Map<String, dynamic> _$$TilesWeatherPluginUpdateForecastWeatherTileImplToJson(
        _$TilesWeatherPluginUpdateForecastWeatherTileImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'hidden': instance.hidden,
    };
