// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCardsPageImpl _$$DashboardCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCardsPageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      cards: (json['cards'] as List<dynamic>)
          .map((e) => DashboardCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCardsPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardCardsPageImplToJson(
        _$DashboardCardsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'order': instance.order,
    };
