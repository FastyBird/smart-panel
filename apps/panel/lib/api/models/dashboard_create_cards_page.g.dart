// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardsPageImpl _$$DashboardCreateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateCardsPageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      cards: (json['cards'] as List<dynamic>)
          .map((e) => DashboardCreateCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateCardsPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateCardsPageImplToJson(
        _$DashboardCreateCardsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };
