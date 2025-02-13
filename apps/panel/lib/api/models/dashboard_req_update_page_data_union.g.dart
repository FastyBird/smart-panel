// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateCardsPageImpl _$$DashboardUpdateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateCardsPageImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      type: json['type'] as String? ?? 'cards',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateCardsPageImplToJson(
        _$DashboardUpdateCardsPageImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardUpdateTilesPageImpl _$$DashboardUpdateTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateTilesPageImpl(
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      type: json['type'] as String? ?? 'tiles',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateTilesPageImplToJson(
        _$DashboardUpdateTilesPageImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'type': instance.type,
      'icon': instance.icon,
    };

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
