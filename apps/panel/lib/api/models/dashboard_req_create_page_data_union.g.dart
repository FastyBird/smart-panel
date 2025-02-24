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
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          cards: (json['cards'] as List<dynamic>)
              .map((e) =>
                  DashboardCreateCard.fromJson(e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateCardsPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          type: json['type'] as String? ?? 'cards',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionCardsImplToJson(
        _$DashboardReqCreatePageDataUnionCardsImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardReqCreatePageDataUnionTilesImpl
    _$$DashboardReqCreatePageDataUnionTilesImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataUnionTilesImpl(
          id: json['id'] as String,
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          tiles: (json['tiles'] as List<dynamic>)
              .map((e) => DashboardCreateTilesPageTilesUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          dataSource: (json['data_source'] as List<dynamic>)
              .map((e) => DashboardCreateTilesPageDataSourceUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          type: json['type'] as String? ?? 'tiles',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionTilesImplToJson(
        _$DashboardReqCreatePageDataUnionTilesImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardReqCreatePageDataUnionDeviceImpl
    _$$DashboardReqCreatePageDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataUnionDeviceImpl(
          id: json['id'] as String,
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          device: json['device'] as String,
          type: json['type'] as String? ?? 'device',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqCreatePageDataUnionDeviceImplToJson(
        _$DashboardReqCreatePageDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'type': instance.type,
      'icon': instance.icon,
    };
