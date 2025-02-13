// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_device_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDevicePageImpl _$$DashboardCreateDevicePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateDevicePageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      device: json['device'] as String,
      type: json['type'] as String? ?? 'device',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateDevicePageImplToJson(
        _$DashboardCreateDevicePageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'type': instance.type,
      'icon': instance.icon,
    };
