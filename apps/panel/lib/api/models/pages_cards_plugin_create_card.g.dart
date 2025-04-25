// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_cards_plugin_create_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesCardsPluginCreateCardImpl _$$PagesCardsPluginCreateCardImplFromJson(
        Map<String, dynamic> json) =>
    _$PagesCardsPluginCreateCardImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) =>
              DashboardModuleCreateTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardModuleCreateDataSource.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$PagesCardsPluginCreateCardImplToJson(
        _$PagesCardsPluginCreateCardImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'icon': instance.icon,
    };
