// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_page_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreatePageBaseImpl _$$DashboardCreatePageBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreatePageBaseImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreatePageBaseImplToJson(
        _$DashboardCreatePageBaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
