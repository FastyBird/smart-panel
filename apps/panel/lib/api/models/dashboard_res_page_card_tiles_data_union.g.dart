// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tiles_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTilesDataUnionDeviceImpl
    _$$DashboardResPageCardTilesDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTilesDataUnionDeviceImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'device',
        );

Map<String, dynamic> _$$DashboardResPageCardTilesDataUnionDeviceImplToJson(
        _$DashboardResPageCardTilesDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'icon': instance.icon,
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardResPageCardTilesDataUnionClockImpl
    _$$DashboardResPageCardTilesDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTilesDataUnionClockImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'clock',
        );

Map<String, dynamic> _$$DashboardResPageCardTilesDataUnionClockImplToJson(
        _$DashboardResPageCardTilesDataUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardResPageCardTilesDataUnionWeatherDayImpl
    _$$DashboardResPageCardTilesDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTilesDataUnionWeatherDayImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'weather-day',
        );

Map<String, dynamic> _$$DashboardResPageCardTilesDataUnionWeatherDayImplToJson(
        _$DashboardResPageCardTilesDataUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
      'type': instance.type,
    };

_$DashboardResPageCardTilesDataUnionWeatherForecastImpl
    _$$DashboardResPageCardTilesDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTilesDataUnionWeatherForecastImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
          type: json['type'] as String? ?? 'weather-forecast',
        );

Map<String, dynamic>
    _$$DashboardResPageCardTilesDataUnionWeatherForecastImplToJson(
            _$DashboardResPageCardTilesDataUnionWeatherForecastImpl instance) =>
        <String, dynamic>{
          'id': instance.id,
          'row': instance.row,
          'col': instance.col,
          'data_source': instance.dataSource,
          'created_at': instance.createdAt.toIso8601String(),
          'updated_at': instance.updatedAt?.toIso8601String(),
          'card': instance.card,
          'row_span': instance.rowSpan,
          'col_span': instance.colSpan,
          'type': instance.type,
        };
