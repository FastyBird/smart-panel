// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tiles_page_tiles_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTilesPageTilesUnionDeviceImpl
    _$$DashboardCreateTilesPageTilesUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionDeviceImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageTilesUnionDeviceImplToJson(
        _$DashboardCreateTilesPageTilesUnionDeviceImpl instance) =>
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

_$DashboardCreateTilesPageTilesUnionClockImpl
    _$$DashboardCreateTilesPageTilesUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionClockImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageTilesUnionClockImplToJson(
        _$DashboardCreateTilesPageTilesUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardCreateTilesPageTilesUnionWeatherDayImpl
    _$$DashboardCreateTilesPageTilesUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageTilesUnionWeatherDayImplToJson(
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl
    _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
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

Map<String, dynamic>
    _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplToJson(
            _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl instance) =>
        <String, dynamic>{
          'id': instance.id,
          'row': instance.row,
          'col': instance.col,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
          'data_source': instance.dataSource,
          'type': instance.type,
        };
