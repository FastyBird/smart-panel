// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreatePageDataUnionCardsImpl
    _$$DashboardReqCreatePageDataUnionCardsImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataUnionCardsImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          cards: (json['cards'] as List<dynamic>)
              .map((e) =>
                  DashboardCreateCard.fromJson(e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateCardsPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionCardsImplToJson(
        _$DashboardReqCreatePageDataUnionCardsImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };

_$DashboardReqCreatePageDataUnionTilesImpl
    _$$DashboardReqCreatePageDataUnionTilesImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataUnionTilesImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          tiles: (json['tiles'] as List<dynamic>)
              .map((e) => DashboardCreateTilesPageTilesUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTilesPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionTilesImplToJson(
        _$DashboardReqCreatePageDataUnionTilesImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'order': instance.order,
      'icon': instance.icon,
    };

_$DashboardReqCreatePageDataUnionDeviceDetailImpl
    _$$DashboardReqCreatePageDataUnionDeviceDetailImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataUnionDeviceDetailImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          title: json['title'] as String,
          device: json['device'] as String,
          order: (json['order'] as num?)?.toInt() ?? 0,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionDeviceDetailImplToJson(
        _$DashboardReqCreatePageDataUnionDeviceDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'device': instance.device,
      'order': instance.order,
      'icon': instance.icon,
    };
