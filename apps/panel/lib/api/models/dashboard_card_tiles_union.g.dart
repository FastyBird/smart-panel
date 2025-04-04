// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_card_tiles_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCardTilesUnionDevicePreviewImpl
    _$$DashboardCardTilesUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCardTilesUnionDevicePreviewImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardCardTilesUnionDevicePreviewImplToJson(
        _$DashboardCardTilesUnionDevicePreviewImpl instance) =>
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
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardCardTilesUnionClockImpl _$$DashboardCardTilesUnionClockImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCardTilesUnionClockImpl(
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
      card: json['card'] as String,
      rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
      colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardCardTilesUnionClockImplToJson(
        _$DashboardCardTilesUnionClockImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardCardTilesUnionWeatherDayImpl
    _$$DashboardCardTilesUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCardTilesUnionWeatherDayImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardCardTilesUnionWeatherDayImplToJson(
        _$DashboardCardTilesUnionWeatherDayImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };

_$DashboardCardTilesUnionWeatherForecastImpl
    _$$DashboardCardTilesUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCardTilesUnionWeatherForecastImpl(
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
          card: json['card'] as String,
          rowSpan: (json['row_span'] as num?)?.toInt() ?? 0,
          colSpan: (json['col_span'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardCardTilesUnionWeatherForecastImplToJson(
        _$DashboardCardTilesUnionWeatherForecastImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'row': instance.row,
      'col': instance.col,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'card': instance.card,
      'row_span': instance.rowSpan,
      'col_span': instance.colSpan,
    };
