// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_device_property_update_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyDevicePropertyUpdateResultImpl
    _$$DevicesThirdPartyDevicePropertyUpdateResultImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyDevicePropertyUpdateResultImpl(
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          status: DevicesThirdPartyErrorCode.fromJson(json['status'] as num),
        );

Map<String, dynamic> _$$DevicesThirdPartyDevicePropertyUpdateResultImplToJson(
        _$DevicesThirdPartyDevicePropertyUpdateResultImpl instance) =>
    <String, dynamic>{
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'status': _$DevicesThirdPartyErrorCodeEnumMap[instance.status]!,
    };

const _$DevicesThirdPartyErrorCodeEnumMap = {
  DevicesThirdPartyErrorCode.value0: 0,
  DevicesThirdPartyErrorCode.valueMinus80001: -80001,
  DevicesThirdPartyErrorCode.valueMinus80002: -80002,
  DevicesThirdPartyErrorCode.valueMinus80003: -80003,
  DevicesThirdPartyErrorCode.valueMinus80004: -80004,
  DevicesThirdPartyErrorCode.valueMinus80005: -80005,
  DevicesThirdPartyErrorCode.valueMinus80006: -80006,
  DevicesThirdPartyErrorCode.valueMinus80007: -80007,
  DevicesThirdPartyErrorCode.valueMinus80008: -80008,
  DevicesThirdPartyErrorCode.valueMinus80009: -80009,
  DevicesThirdPartyErrorCode.valueMinus80010: -80010,
  DevicesThirdPartyErrorCode.valueMinus80011: -80011,
  DevicesThirdPartyErrorCode.$unknown: r'$unknown',
};
