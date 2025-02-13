// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDeviceTileImpl _$$DashboardUpdateDeviceTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateDeviceTileImpl(
      row: (json['row'] as num).toInt(),
      col: (json['col'] as num).toInt(),
      rowSpan: (json['row_span'] as num).toInt(),
      colSpan: (json['col_span'] as num).toInt(),
      device: json['device'] as String,
      icon: json['icon'] as String?,
      type: json['type'] as String? ?? 'device',
    );

Map<String, dynamic> _$$DashboardUpdateDeviceTileImplToJson(
        _$DashboardUpdateDeviceTileImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'device': instance.device,
      'icon': instance.icon,
      'type': instance.type,
    };

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

_$DashboardUpdateForecastWeatherTileImpl
    _$$DashboardUpdateForecastWeatherTileImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardUpdateForecastWeatherTileImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          type: json['type'] as String? ?? 'weather-forecast',
        );

Map<String, dynamic> _$$DashboardUpdateForecastWeatherTileImplToJson(
        _$DashboardUpdateForecastWeatherTileImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
