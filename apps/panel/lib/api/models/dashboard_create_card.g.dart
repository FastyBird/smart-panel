// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardImpl _$$DashboardCreateCardImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateCardImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardCreateTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) =>
              DashboardCreateDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateCardImplToJson(
        _$DashboardCreateCardImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'icon': instance.icon,
    };
