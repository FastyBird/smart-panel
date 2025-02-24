// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileDataUnionDeviceImpl
    _$$DashboardResPageCardTileDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionDeviceImpl(
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

Map<String, dynamic> _$$DashboardResPageCardTileDataUnionDeviceImplToJson(
        _$DashboardResPageCardTileDataUnionDeviceImpl instance) =>
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

_$DashboardResPageCardTileDataUnionClockImpl
    _$$DashboardResPageCardTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardResPageCardTileDataUnionClockImplToJson(
        _$DashboardResPageCardTileDataUnionClockImpl instance) =>
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

_$DashboardResPageCardTileDataUnionWeatherDayImpl
    _$$DashboardResPageCardTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardResPageCardTileDataUnionWeatherDayImplToJson(
        _$DashboardResPageCardTileDataUnionWeatherDayImpl instance) =>
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

_$DashboardResPageCardTileDataUnionWeatherForecastImpl
    _$$DashboardResPageCardTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionWeatherForecastImpl(
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

Map<String, dynamic>
    _$$DashboardResPageCardTileDataUnionWeatherForecastImplToJson(
            _$DashboardResPageCardTileDataUnionWeatherForecastImpl instance) =>
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
