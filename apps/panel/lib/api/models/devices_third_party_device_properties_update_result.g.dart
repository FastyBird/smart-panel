// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_device_properties_update_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyDevicePropertiesUpdateResultImpl
    _$$DevicesThirdPartyDevicePropertiesUpdateResultImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyDevicePropertiesUpdateResultImpl(
          properties: (json['properties'] as List<dynamic>)
              .map((e) => DevicesThirdPartyDevicePropertyUpdateResult.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
        );

Map<String, dynamic> _$$DevicesThirdPartyDevicePropertiesUpdateResultImplToJson(
        _$DevicesThirdPartyDevicePropertiesUpdateResultImpl instance) =>
    <String, dynamic>{
      'properties': instance.properties,
    };
