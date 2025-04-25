// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_tiles_plugin_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesTilesPluginTilesPageImpl _$$PagesTilesPluginTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$PagesTilesPluginTilesPageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) =>
              DashboardModuleDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardModuleTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$PagesTilesPluginTilesPageImplToJson(
        _$PagesTilesPluginTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'tiles': instance.tiles,
      'order': instance.order,
    };
