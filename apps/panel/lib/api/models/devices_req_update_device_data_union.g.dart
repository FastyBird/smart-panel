// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_req_update_device_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesReqUpdateDeviceDataUnionThirdPartyImpl
    _$$DevicesReqUpdateDeviceDataUnionThirdPartyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesReqUpdateDeviceDataUnionThirdPartyImpl(
          name: json['name'] as String,
          serviceAddress: json['service_address'] as String,
          type: json['type'] as String? ?? 'third-party',
          description: json['description'] as String?,
        );

Map<String, dynamic> _$$DevicesReqUpdateDeviceDataUnionThirdPartyImplToJson(
        _$DevicesReqUpdateDeviceDataUnionThirdPartyImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'service_address': instance.serviceAddress,
      'type': instance.type,
      'description': instance.description,
    };
