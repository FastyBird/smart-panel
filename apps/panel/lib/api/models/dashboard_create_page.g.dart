// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreatePageImpl _$$DashboardCreatePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreatePageImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) =>
              DashboardCreateDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      order: (json['order'] as num?)?.toInt() ?? 0,
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreatePageImplToJson(
        _$DashboardCreatePageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };
