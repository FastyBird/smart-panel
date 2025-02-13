// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_device_properties_update_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyDevicePropertiesUpdateRequestImpl
    _$$DevicesThirdPartyDevicePropertiesUpdateRequestImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyDevicePropertiesUpdateRequestImpl(
          properties: (json['properties'] as List<dynamic>)
              .map((e) => DevicesThirdPartyDevicePropertyUpdateRequest.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
        );

Map<String, dynamic>
    _$$DevicesThirdPartyDevicePropertiesUpdateRequestImplToJson(
            _$DevicesThirdPartyDevicePropertiesUpdateRequestImpl instance) =>
        <String, dynamic>{
          'properties': instance.properties,
        };
