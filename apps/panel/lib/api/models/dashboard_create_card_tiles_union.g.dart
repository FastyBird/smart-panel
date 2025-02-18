// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_card_tiles_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDeviceTileImpl _$$DashboardCreateDeviceTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateDeviceTileImpl(
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

Map<String, dynamic> _$$DashboardCreateDeviceTileImplToJson(
        _$DashboardCreateDeviceTileImpl instance) =>
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

_$DashboardCreateTimeTileImpl _$$DashboardCreateTimeTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateTimeTileImpl(
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

Map<String, dynamic> _$$DashboardCreateTimeTileImplToJson(
        _$DashboardCreateTimeTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardCreateDayWeatherTileImpl
    _$$DashboardCreateDayWeatherTileImplFromJson(Map<String, dynamic> json) =>
        _$DashboardCreateDayWeatherTileImpl(
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

Map<String, dynamic> _$$DashboardCreateDayWeatherTileImplToJson(
        _$DashboardCreateDayWeatherTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardCreateForecastWeatherTileImpl
    _$$DashboardCreateForecastWeatherTileImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateForecastWeatherTileImpl(
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

Map<String, dynamic> _$$DashboardCreateForecastWeatherTileImplToJson(
        _$DashboardCreateForecastWeatherTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };
