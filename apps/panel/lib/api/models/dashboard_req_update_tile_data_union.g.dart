// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqUpdateTileDataUnionDeviceImpl
    _$$DashboardReqUpdateTileDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionDeviceImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device',
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionDeviceImplToJson(
        _$DashboardReqUpdateTileDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'device': instance.device,
      'icon': instance.icon,
      'type': instance.type,
    };

_$DashboardReqUpdateTileDataUnionClockImpl
    _$$DashboardReqUpdateTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionClockImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          type: json['type'] as String? ?? 'clock',
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionClockImplToJson(
        _$DashboardReqUpdateTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardReqUpdateTileDataUnionWeatherDayImpl
    _$$DashboardReqUpdateTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionWeatherDayImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          type: json['type'] as String? ?? 'weather-day',
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionWeatherDayImplToJson(
        _$DashboardReqUpdateTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardReqUpdateTileDataUnionWeatherForecastImpl
    _$$DashboardReqUpdateTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionWeatherForecastImpl(
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          type: json['type'] as String? ?? 'weather-forecast',
        );

Map<String, dynamic>
    _$$DashboardReqUpdateTileDataUnionWeatherForecastImplToJson(
            _$DashboardReqUpdateTileDataUnionWeatherForecastImpl instance) =>
        <String, dynamic>{
          'row': instance.row,
          'col': instance.col,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
          'type': instance.type,
        };
