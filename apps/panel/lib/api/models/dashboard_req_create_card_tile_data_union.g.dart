// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_card_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreateCardTileDataUnionDevicePreviewImpl
    _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl(
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
    _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplToJson(
            _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl instance) =>
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

_$DashboardReqCreateCardTileDataUnionClockImpl
    _$$DashboardReqCreateCardTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardReqCreateCardTileDataUnionClockImplToJson(
        _$DashboardReqCreateCardTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqCreateCardTileDataUnionWeatherDayImpl
    _$$DashboardReqCreateCardTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardReqCreateCardTileDataUnionWeatherDayImplToJson(
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl
    _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
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
    dynamic> _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplToJson(
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
