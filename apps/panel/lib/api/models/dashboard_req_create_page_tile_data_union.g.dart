// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_page_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreatePageTileDataUnionDeviceImpl
    _$$DashboardReqCreatePageTileDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionDeviceImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device',
        );

Map<String, dynamic> _$$DashboardReqCreatePageTileDataUnionDeviceImplToJson(
        _$DashboardReqCreatePageTileDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'device': instance.device,
      'icon': instance.icon,
      'type': instance.type,
    };

_$DashboardReqCreatePageTileDataUnionClockImpl
    _$$DashboardReqCreatePageTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionClockImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          type: json['type'] as String? ?? 'clock',
        );

Map<String, dynamic> _$$DashboardReqCreatePageTileDataUnionClockImplToJson(
        _$DashboardReqCreatePageTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardReqCreatePageTileDataUnionWeatherDayImpl
    _$$DashboardReqCreatePageTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionWeatherDayImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          type: json['type'] as String? ?? 'weather-day',
        );

Map<String, dynamic> _$$DashboardReqCreatePageTileDataUnionWeatherDayImplToJson(
        _$DashboardReqCreatePageTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardReqCreatePageTileDataUnionWeatherForecastImpl
    _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          rowSpan: (json['row_span'] as num).toInt(),
          colSpan: (json['col_span'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          type: json['type'] as String? ?? 'weather-forecast',
        );

Map<String,
    dynamic> _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplToJson(
        _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };
