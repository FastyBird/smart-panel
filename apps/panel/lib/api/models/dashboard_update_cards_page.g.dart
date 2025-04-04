// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_cards_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateCardsPageImpl _$$DashboardUpdateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateCardsPageImpl(
      type: json['type'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateCardsPageImplToJson(
        _$DashboardUpdateCardsPageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
