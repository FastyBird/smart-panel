// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_cards_plugin_create_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesCardsPluginCreateCardsPageImpl
    _$$PagesCardsPluginCreateCardsPageImplFromJson(Map<String, dynamic> json) =>
        _$PagesCardsPluginCreateCardsPageImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardModuleCreateDataSource.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          cards: (json['cards'] as List<dynamic>)
              .map((e) => PagesCardsPluginCreateCard.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$PagesCardsPluginCreateCardsPageImplToJson(
        _$PagesCardsPluginCreateCardsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'data_source': instance.dataSource,
      'cards': instance.cards,
      'order': instance.order,
      'icon': instance.icon,
    };
