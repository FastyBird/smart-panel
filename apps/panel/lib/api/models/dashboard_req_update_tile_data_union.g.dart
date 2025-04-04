// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqUpdateTileDataUnionDevicePreviewImpl
    _$$DashboardReqUpdateTileDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionDevicePreviewImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionDevicePreviewImplToJson(
        _$DashboardReqUpdateTileDataUnionDevicePreviewImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'device': instance.device,
      'icon': instance.icon,
    };

_$DashboardReqUpdateTileDataUnionClockImpl
    _$$DashboardReqUpdateTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionClockImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionClockImplToJson(
        _$DashboardReqUpdateTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqUpdateTileDataUnionWeatherDayImpl
    _$$DashboardReqUpdateTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionWeatherDayImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
        );

Map<String, dynamic> _$$DashboardReqUpdateTileDataUnionWeatherDayImplToJson(
        _$DashboardReqUpdateTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqUpdateTileDataUnionWeatherForecastImpl
    _$$DashboardReqUpdateTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateTileDataUnionWeatherForecastImpl(
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
        );

Map<String, dynamic>
    _$$DashboardReqUpdateTileDataUnionWeatherForecastImplToJson(
            _$DashboardReqUpdateTileDataUnionWeatherForecastImpl instance) =>
        <String, dynamic>{
          'type': instance.type,
          'row': instance.row,
          'col': instance.col,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
        };
