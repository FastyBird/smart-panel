// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_create_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleCreatePageImpl _$$DashboardModuleCreatePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleCreatePageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardModuleCreateDataSource.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardModuleCreatePageImplToJson(
        _$DashboardModuleCreatePageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };
