// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileDataUnionDevicePreviewImpl
    _$$DashboardResPageCardTileDataUnionDevicePreviewImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionDevicePreviewImpl(
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

Map<String, dynamic>
    _$$DashboardResPageCardTileDataUnionDevicePreviewImplToJson(
            _$DashboardResPageCardTileDataUnionDevicePreviewImpl instance) =>
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

_$DashboardResPageCardTileDataUnionClockImpl
    _$$DashboardResPageCardTileDataUnionClockImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionClockImpl(
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

Map<String, dynamic> _$$DashboardResPageCardTileDataUnionClockImplToJson(
        _$DashboardResPageCardTileDataUnionClockImpl instance) =>
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

_$DashboardResPageCardTileDataUnionWeatherDayImpl
    _$$DashboardResPageCardTileDataUnionWeatherDayImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionWeatherDayImpl(
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

Map<String, dynamic> _$$DashboardResPageCardTileDataUnionWeatherDayImplToJson(
        _$DashboardResPageCardTileDataUnionWeatherDayImpl instance) =>
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

_$DashboardResPageCardTileDataUnionWeatherForecastImpl
    _$$DashboardResPageCardTileDataUnionWeatherForecastImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataUnionWeatherForecastImpl(
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

Map<String, dynamic>
    _$$DashboardResPageCardTileDataUnionWeatherForecastImplToJson(
            _$DashboardResPageCardTileDataUnionWeatherForecastImpl instance) =>
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
