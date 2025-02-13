// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateCardsPageImpl _$$DashboardUpdateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateCardsPageImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      type: json['type'] as String? ?? 'cards',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateCardsPageImplToJson(
        _$DashboardUpdateCardsPageImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'type': instance.type,
      'icon': instance.icon,
    };
