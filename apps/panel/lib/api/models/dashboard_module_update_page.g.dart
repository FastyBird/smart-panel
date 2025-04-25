// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_update_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleUpdatePageImpl _$$DashboardModuleUpdatePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleUpdatePageImpl(
      type: json['type'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardModuleUpdatePageImplToJson(
        _$DashboardModuleUpdatePageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
