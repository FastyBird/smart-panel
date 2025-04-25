// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_device_detail_plugin_update_device_detail_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesDeviceDetailPluginUpdateDeviceDetailPageImpl
    _$$PagesDeviceDetailPluginUpdateDeviceDetailPageImplFromJson(
            Map<String, dynamic> json) =>
        _$PagesDeviceDetailPluginUpdateDeviceDetailPageImpl(
          type: json['type'] as String,
          title: json['title'] as String,
          order: (json['order'] as num).toInt(),
          device: json['device'] as String,
          icon: json['icon'] as String?,
        );

Map<String, dynamic> _$$PagesDeviceDetailPluginUpdateDeviceDetailPageImplToJson(
        _$PagesDeviceDetailPluginUpdateDeviceDetailPageImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'order': instance.order,
      'device': instance.device,
      'icon': instance.icon,
    };
