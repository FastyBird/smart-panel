// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_update_third_party_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesUpdateThirdPartyDeviceImpl
    _$$DevicesUpdateThirdPartyDeviceImplFromJson(Map<String, dynamic> json) =>
        _$DevicesUpdateThirdPartyDeviceImpl(
          name: json['name'] as String,
          serviceAddress: json['service_address'] as String,
          type: json['type'] as String? ?? 'third-party',
          description: json['description'] as String?,
        );

Map<String, dynamic> _$$DevicesUpdateThirdPartyDeviceImplToJson(
        _$DevicesUpdateThirdPartyDeviceImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'service_address': instance.serviceAddress,
      'type': instance.type,
      'description': instance.description,
    };
