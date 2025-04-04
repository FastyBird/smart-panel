// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_device_detail_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateDeviceDetailPageImpl
    _$$DashboardUpdateDeviceDetailPageImplFromJson(Map<String, dynamic> json) =>
        _$DashboardUpdateDeviceDetailPageImpl(
          type: json['type'] as String,
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardUpdateDeviceDetailPageImplToJson(
        _$DashboardUpdateDeviceDetailPageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'icon': instance.icon,
    };
