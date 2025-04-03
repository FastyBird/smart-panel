// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_page_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardPageBaseImpl _$$DashboardPageBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardPageBaseImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardPageBaseImplToJson(
        _$DashboardPageBaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'order': instance.order,
    };
