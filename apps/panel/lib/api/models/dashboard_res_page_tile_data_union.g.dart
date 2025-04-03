// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTileDataUnionDevicePreviewImpl
    _$$DashboardResPageTileDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTileDataUnionDevicePreviewImpl(
          id: json['id'] as String,
          type: json['type'] as String,
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
          page: json['page'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageTileDataUnionDevicePreviewImplToJson(
        _$DashboardResPageTileDataUnionDevicePreviewImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'icon': instance.icon,
      'page': instance.page,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardResPageTileDataUnionClockImpl
    _$$DashboardResPageTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTileDataUnionClockImpl(
          id: json['id'] as String,
          type: json['type'] as String,
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
          page: json['page'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageTileDataUnionClockImplToJson(
        _$DashboardResPageTileDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'page': instance.page,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardResPageTileDataUnionWeatherDayImpl
    _$$DashboardResPageTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTileDataUnionWeatherDayImpl(
          id: json['id'] as String,
          type: json['type'] as String,
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
          page: json['page'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageTileDataUnionWeatherDayImplToJson(
        _$DashboardResPageTileDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'page': instance.page,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardResPageTileDataUnionWeatherForecastImpl
    _$$DashboardResPageTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTileDataUnionWeatherForecastImpl(
          id: json['id'] as String,
          type: json['type'] as String,
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
          page: json['page'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageTileDataUnionWeatherForecastImplToJson(
        _$DashboardResPageTileDataUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'page': instance.page,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
