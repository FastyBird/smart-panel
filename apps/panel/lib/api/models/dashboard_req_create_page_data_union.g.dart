// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardsPageImpl _$$DashboardCreateCardsPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateCardsPageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      cards: (json['cards'] as List<dynamic>)
          .map((e) => DashboardCreateCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      dataSource: (json['data_source'] as List<dynamic>)
          .map((e) => DashboardCreateCardsPageDataSourceUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      type: json['type'] as String? ?? 'cards',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateCardsPageImplToJson(
        _$DashboardCreateCardsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'cards': instance.cards,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardCreateTilesPageImpl _$$DashboardCreateTilesPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateTilesPageImpl(
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

Map<String, dynamic> _$$DashboardCreateTilesPageImplToJson(
        _$DashboardCreateTilesPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'tiles': instance.tiles,
      'data_source': instance.dataSource,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardCreateDevicePageImpl _$$DashboardCreateDevicePageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardCreateDevicePageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      order: (json['order'] as num).toInt(),
      device: json['device'] as String,
      type: json['type'] as String? ?? 'device',
      icon: json['icon'] as String?,
    );

Map<String, dynamic> _$$DashboardCreateDevicePageImplToJson(
        _$DashboardCreateDevicePageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'type': instance.type,
      'icon': instance.icon,
    };
