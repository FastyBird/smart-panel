// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tiles_page_tiles_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTilesPageTilesUnionDevicePreviewImpl
    _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl(
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
    _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplToJson(
            _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl instance) =>
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

_$DashboardCreateTilesPageTilesUnionClockImpl
    _$$DashboardCreateTilesPageTilesUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionClockImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageTilesUnionClockImplToJson(
        _$DashboardCreateTilesPageTilesUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardCreateTilesPageTilesUnionWeatherDayImpl
    _$$DashboardCreateTilesPageTilesUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageTilesUnionWeatherDayImplToJson(
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl
    _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
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

Map<String, dynamic>
    _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplToJson(
            _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl instance) =>
        <String, dynamic>{
          'id': instance.id,
          'type': instance.type,
          'row': instance.row,
          'col': instance.col,
          'data_source': instance.dataSource,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
        };
