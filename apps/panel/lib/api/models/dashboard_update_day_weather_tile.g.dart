// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_day_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDayWeatherTileImpl
    _$$DashboardUpdateDayWeatherTileImplFromJson(Map<String, dynamic> json) =>
        _$DashboardUpdateDayWeatherTileImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          type: json['type'] as String? ?? 'weather-day',
        );

Map<String, dynamic> _$$DashboardUpdateDayWeatherTileImplToJson(
        _$DashboardUpdateDayWeatherTileImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
