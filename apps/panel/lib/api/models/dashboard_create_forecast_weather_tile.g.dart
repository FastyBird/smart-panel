// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_forecast_weather_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

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
