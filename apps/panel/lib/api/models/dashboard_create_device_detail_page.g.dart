// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_device_detail_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateDeviceDetailPageImpl
    _$$DashboardCreateDeviceDetailPageImplFromJson(Map<String, dynamic> json) =>
        _$DashboardCreateDeviceDetailPageImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          device: json['device'] as String,
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardCreateDeviceDetailPageImplToJson(
        _$DashboardCreateDeviceDetailPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'device': instance.device,
      'order': instance.order,
      'icon': instance.icon,
    };
