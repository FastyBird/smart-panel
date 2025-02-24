// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_tiles_page_tiles_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardTilesPageTilesUnionDeviceImpl
    _$$DashboardTilesPageTilesUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardTilesPageTilesUnionDeviceImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          icon: json['icon'] as String?,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'device',
        );

Map<String, dynamic> _$$DashboardTilesPageTilesUnionDeviceImplToJson(
        _$DashboardTilesPageTilesUnionDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'icon': instance.icon,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardTilesPageTilesUnionClockImpl
    _$$DashboardTilesPageTilesUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardTilesPageTilesUnionClockImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'clock',
        );

Map<String, dynamic> _$$DashboardTilesPageTilesUnionClockImplToJson(
        _$DashboardTilesPageTilesUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardTilesPageTilesUnionWeatherDayImpl
    _$$DashboardTilesPageTilesUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardTilesPageTilesUnionWeatherDayImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'weather-day',
        );

Map<String, dynamic> _$$DashboardTilesPageTilesUnionWeatherDayImplToJson(
        _$DashboardTilesPageTilesUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardTilesPageTilesUnionWeatherForecastImpl
    _$$DashboardTilesPageTilesUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardTilesPageTilesUnionWeatherForecastImpl(
          id: json['id'] as String,
          row: (json['row'] as num).toInt(),
          col: (json['col'] as num).toInt(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardTileBaseDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'weather-forecast',
        );

Map<String, dynamic> _$$DashboardTilesPageTilesUnionWeatherForecastImplToJson(
        _$DashboardTilesPageTilesUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
