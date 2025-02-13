// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTilesPageImpl _$$DashboardCreateTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateTilesPageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardCreateTilesPageTilesUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateTilesPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      type: json['type'] as String? ?? 'tiles',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateTilesPageImplToJson(
        _$DashboardCreateTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };
