// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCardImpl _$$DashboardCardImplFromJson(Map<String, dynamic> json) =>
    _$DashboardCardImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      icon: json['icon'] as String?,
      page: json['page'] as String,
      tiles: (json['tiles'] as List<dynamic>)
          .map((e) => DashboardTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      order: (json['order'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardCardImplToJson(_$DashboardCardImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'page': instance.page,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'order': instance.order,
    };
