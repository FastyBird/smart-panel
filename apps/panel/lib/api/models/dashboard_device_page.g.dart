// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_device_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardDevicePageImpl _$$DashboardDevicePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardDevicePageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      order: (json['order'] as num).toInt(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      device: json['device'] as String,
      type: json['type'] as String? ?? 'device',
    );

Map<String, dynamic> _$$DashboardDevicePageImplToJson(
        _$DashboardDevicePageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'order': instance.order,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'type': instance.type,
    };
