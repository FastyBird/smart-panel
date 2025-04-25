// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_tiles_plugin_create_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesTilesPluginCreateTilesPageImpl
    _$$PagesTilesPluginCreateTilesPageImplFromJson(Map<String, dynamic> json) =>
        _$PagesTilesPluginCreateTilesPageImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardModuleCreateDataSource.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          tiles: (json['tiles'] as List<dynamic>)
              .map((e) =>
                  DashboardModuleCreateTile.fromJson(e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$PagesTilesPluginCreateTilesPageImplToJson(
        _$PagesTilesPluginCreateTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'data_source': instance.dataSource,
      'tiles': instance.tiles,
      'order': instance.order,
      'icon': instance.icon,
    };
