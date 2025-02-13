// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDevicePageImpl _$$DashboardUpdateDevicePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateDevicePageImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      device: json['device'] as String,
      type: json['type'] as String? ?? 'device',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateDevicePageImplToJson(
        _$DashboardUpdateDevicePageImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'type': instance.type,
      'icon': instance.icon,
    };
