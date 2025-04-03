// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateTilesPageImpl _$$DashboardCreateTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateTilesPageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardCreateTilesPageTilesUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateTilesPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateTilesPageImplToJson(
        _$DashboardCreateTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };
