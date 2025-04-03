// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_day_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardDayWeatherTileImpl _$$DashboardDayWeatherTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardDayWeatherTileImpl(
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
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardDayWeatherTileImplToJson(
        _$DashboardDayWeatherTileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
