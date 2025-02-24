// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageDataUnionCardsImpl
    _$$DashboardResPageDataUnionCardsImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionCardsImpl(
          id: json['id'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          order: (json['order'] as num).toInt(),
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
          type: json['type'] as String? ?? 'cards',
        );

Map<String, dynamic> _$$DashboardResPageDataUnionCardsImplToJson(
        _$DashboardResPageDataUnionCardsImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'order': instance.order,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardResPageDataUnionTilesImpl
    _$$DashboardResPageDataUnionTilesImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionTilesImpl(
          id: json['id'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          order: (json['order'] as num).toInt(),
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
          type: json['type'] as String? ?? 'tiles',
        );

Map<String, dynamic> _$$DashboardResPageDataUnionTilesImplToJson(
        _$DashboardResPageDataUnionTilesImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'order': instance.order,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'type': instance.type,
    };

_$DashboardResPageDataUnionDeviceImpl
    _$$DashboardResPageDataUnionDeviceImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageDataUnionDeviceImpl(
          id: json['id'] as String,
          title: json['title'] as String,
          icon: json['icon'] as String?,
          order: (json['order'] as num).toInt(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          device: json['device'] as String,
          type: json['type'] as String? ?? 'device',
        );

Map<String, dynamic> _$$DashboardResPageDataUnionDeviceImplToJson(
        _$DashboardResPageDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'icon': instance.icon,
      'order': instance.order,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'device': instance.device,
      'type': instance.type,
    };
