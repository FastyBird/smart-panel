// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_page_day_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardPageDayWeatherTileImpl _$$DashboardPageDayWeatherTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardPageDayWeatherTileImpl(
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
      page: json['page'] as String,
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'weather-day',
    );

Map<String, dynamic> _$$DashboardPageDayWeatherTileImplToJson(
        _$DashboardPageDayWeatherTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'page': instance.page,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };
