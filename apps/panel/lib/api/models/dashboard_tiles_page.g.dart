// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardTilesPageImpl _$$DashboardTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardTilesPageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      order: (json['order'] as num).toInt(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) =>
              DashboardTilesPageTilesUnion.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardTilesPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      type: json['type'] as String? ?? 'tiles',
    );

Map<String, dynamic> _$$DashboardTilesPageImplToJson(
        _$DashboardTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'order': instance.order,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'type': instance.type,
    };
