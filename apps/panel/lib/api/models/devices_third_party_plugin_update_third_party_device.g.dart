// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_update_third_party_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginUpdateThirdPartyDeviceImpl
    _$$DevicesThirdPartyPluginUpdateThirdPartyDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginUpdateThirdPartyDeviceImpl(
          type: json['type'] as String,
          name: json['name'] as String,
          serviceAddress: json['service_address'] as String,
          description: json['description'] as String?,
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginUpdateThirdPartyDeviceImplToJson(
        _$DevicesThirdPartyPluginUpdateThirdPartyDeviceImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'name': instance.name,
      'service_address': instance.serviceAddress,
      'description': instance.description,
    };
