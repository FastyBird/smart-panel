// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdatePageImpl _$$DashboardUpdatePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdatePageImpl(
      type: json['type'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdatePageImplToJson(
        _$DashboardUpdatePageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
