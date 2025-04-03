// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tiles_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTilesDataUnionDevicePreviewImpl
    _$$DashboardResPageTilesDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTilesDataUnionDevicePreviewImpl(
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

Map<String, dynamic> _$$DashboardResPageTilesDataUnionDevicePreviewImplToJson(
        _$DashboardResPageTilesDataUnionDevicePreviewImpl instance) =>
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

_$DashboardResPageTilesDataUnionClockImpl
    _$$DashboardResPageTilesDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTilesDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardResPageTilesDataUnionClockImplToJson(
        _$DashboardResPageTilesDataUnionClockImpl instance) =>
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

_$DashboardResPageTilesDataUnionWeatherDayImpl
    _$$DashboardResPageTilesDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTilesDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardResPageTilesDataUnionWeatherDayImplToJson(
        _$DashboardResPageTilesDataUnionWeatherDayImpl instance) =>
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

_$DashboardResPageTilesDataUnionWeatherForecastImpl
    _$$DashboardResPageTilesDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageTilesDataUnionWeatherForecastImpl(
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

Map<String, dynamic> _$$DashboardResPageTilesDataUnionWeatherForecastImplToJson(
        _$DashboardResPageTilesDataUnionWeatherForecastImpl instance) =>
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
