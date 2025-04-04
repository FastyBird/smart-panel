// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardUpdateTilesPageImpl _$$DashboardUpdateTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardUpdateTilesPageImpl(
      type: json['type'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardUpdateTilesPageImplToJson(
        _$DashboardUpdateTilesPageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'icon': instance.icon,
    };
