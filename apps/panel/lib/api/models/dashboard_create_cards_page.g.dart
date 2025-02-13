// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardsPageImpl _$$DashboardCreateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateCardsPageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      cards: (json['cards'] as List<dynamic>)
          .map((e) => DashboardCreateCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateCardsPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      type: json['type'] as String? ?? 'cards',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateCardsPageImplToJson(
        _$DashboardCreateCardsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };
