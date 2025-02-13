// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateCardImpl _$$DashboardUpdateCardImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateCardImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateCardImplToJson(
        _$DashboardUpdateCardImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
