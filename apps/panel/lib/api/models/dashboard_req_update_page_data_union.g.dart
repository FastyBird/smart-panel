// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_page_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqUpdatePageDataUnionCardsImpl
    _$$DashboardReqUpdatePageDataUnionCardsImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdatePageDataUnionCardsImpl(
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          type: json['type'] as String? ?? 'cards',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqUpdatePageDataUnionCardsImplToJson(
        _$DashboardReqUpdatePageDataUnionCardsImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardReqUpdatePageDataUnionTilesImpl
    _$$DashboardReqUpdatePageDataUnionTilesImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdatePageDataUnionTilesImpl(
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          type: json['type'] as String? ?? 'tiles',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqUpdatePageDataUnionTilesImplToJson(
        _$DashboardReqUpdatePageDataUnionTilesImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'type': instance.type,
      'icon': instance.icon,
    };

_$DashboardReqUpdatePageDataUnionDeviceImpl
    _$$DashboardReqUpdatePageDataUnionDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdatePageDataUnionDeviceImpl(
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          device: json['device'] as String,
          type: json['type'] as String? ?? 'device',
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$DashboardReqUpdatePageDataUnionDeviceImplToJson(
        _$DashboardReqUpdatePageDataUnionDeviceImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'type': instance.type,
      'icon': instance.icon,
    };
