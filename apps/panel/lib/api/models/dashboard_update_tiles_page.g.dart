// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_update_tiles_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

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
