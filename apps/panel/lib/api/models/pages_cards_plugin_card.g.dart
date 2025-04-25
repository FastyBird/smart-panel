// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_cards_plugin_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesCardsPluginCardImpl _$$PagesCardsPluginCardImplFromJson(
        Map<String, dynamic> json) =>
    _$PagesCardsPluginCardImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      page: json['page'] as String,
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardModuleTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) =>
              DashboardModuleDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$PagesCardsPluginCardImplToJson(
        _$PagesCardsPluginCardImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'page': instance.page,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'order': instance.order,
    };
