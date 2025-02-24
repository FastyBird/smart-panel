// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_card_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreateCardTileDataUnionDeviceImpl
    _$$DashboardReqCreateCardTileDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionDeviceImpl(
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

Map<String, dynamic> _$$DashboardReqCreateCardTileDataUnionDeviceImplToJson(
        _$DashboardReqCreateCardTileDataUnionDeviceImpl instance) =>
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

_$DashboardReqCreateCardTileDataUnionClockImpl
    _$$DashboardReqCreateCardTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardReqCreateCardTileDataUnionClockImplToJson(
        _$DashboardReqCreateCardTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardReqCreateCardTileDataUnionWeatherDayImpl
    _$$DashboardReqCreateCardTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardReqCreateCardTileDataUnionWeatherDayImplToJson(
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl
    _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
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
    dynamic> _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplToJson(
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };
