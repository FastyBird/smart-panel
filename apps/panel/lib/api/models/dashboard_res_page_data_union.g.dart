// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageDataUnionCardsImpl
    _$$DashboardResPageDataUnionCardsImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionCardsImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          cards: (json['cards'] as List<dynamic>)
              .map((e) => DashboardCard.fromJson(e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCardsPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageDataUnionCardsImplToJson(
        _$DashboardResPageDataUnionCardsImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'order': instance.order,
    };

_$DashboardResPageDataUnionTilesImpl
    _$$DashboardResPageDataUnionTilesImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionTilesImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          tiles: (json['tiles'] as List<dynamic>)
              .map((e) => DashboardTilesPageTilesUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardTilesPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageDataUnionTilesImplToJson(
        _$DashboardResPageDataUnionTilesImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'order': instance.order,
    };

_$DashboardResPageDataUnionDeviceDetailImpl
    _$$DashboardResPageDataUnionDeviceDetailImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionDeviceDetailImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          order: (json['order'] as num?)?.toInt() ?? 0,
        );

Map<String, dynamic> _$$DashboardResPageDataUnionDeviceDetailImplToJson(
        _$DashboardResPageDataUnionDeviceDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'icon': instance.icon,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'order': instance.order,
    };
