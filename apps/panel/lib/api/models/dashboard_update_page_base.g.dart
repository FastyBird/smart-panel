// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_page_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdatePageBaseImpl _$$DashboardUpdatePageBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdatePageBaseImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdatePageBaseImplToJson(
        _$DashboardUpdatePageBaseImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
