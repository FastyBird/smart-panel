// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_device_property_update_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyDevicePropertyUpdateRequestImpl
    _$$DevicesThirdPartyDevicePropertyUpdateRequestImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyDevicePropertyUpdateRequestImpl(
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          value: json['value'],
        );

Map<String, dynamic> _$$DevicesThirdPartyDevicePropertyUpdateRequestImplToJson(
        _$DevicesThirdPartyDevicePropertyUpdateRequestImpl instance) =>
    <String, dynamic>{
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'value': instance.value,
    };
