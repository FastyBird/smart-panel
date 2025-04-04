// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_page_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreatePageTileDataUnionDevicePreviewImpl
    _$$DashboardReqCreatePageTileDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionDevicePreviewImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic>
    _$$DashboardReqCreatePageTileDataUnionDevicePreviewImplToJson(
            _$DashboardReqCreatePageTileDataUnionDevicePreviewImpl instance) =>
        <String, dynamic>{
          'id': instance.id,
          'type': instance.type,
          'row': instance.row,
          'col': instance.col,
          'data_source': instance.dataSource,
          'device': instance.device,
          'icon': instance.icon,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
        };

_$DashboardReqCreatePageTileDataUnionClockImpl
    _$$DashboardReqCreatePageTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardReqCreatePageTileDataUnionClockImplToJson(
        _$DashboardReqCreatePageTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqCreatePageTileDataUnionWeatherDayImpl
    _$$DashboardReqCreatePageTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardReqCreatePageTileDataUnionWeatherDayImplToJson(
        _$DashboardReqCreatePageTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqCreatePageTileDataUnionWeatherForecastImpl
    _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl(
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

Map<String,
    dynamic> _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplToJson(
        _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
