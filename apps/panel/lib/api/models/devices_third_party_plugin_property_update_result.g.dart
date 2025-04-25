// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_property_update_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginPropertyUpdateResultImpl
    _$$DevicesThirdPartyPluginPropertyUpdateResultImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginPropertyUpdateResultImpl(
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          status:
              DevicesThirdPartyPluginErrorCode.fromJson(json['status'] as num),
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginPropertyUpdateResultImplToJson(
        _$DevicesThirdPartyPluginPropertyUpdateResultImpl instance) =>
    <String, dynamic>{
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'status': _$DevicesThirdPartyPluginErrorCodeEnumMap[instance.status]!,
    };

const _$DevicesThirdPartyPluginErrorCodeEnumMap = {
  DevicesThirdPartyPluginErrorCode.value0: 0,
  DevicesThirdPartyPluginErrorCode.valueMinus80001: -80001,
  DevicesThirdPartyPluginErrorCode.valueMinus80002: -80002,
  DevicesThirdPartyPluginErrorCode.valueMinus80003: -80003,
  DevicesThirdPartyPluginErrorCode.valueMinus80004: -80004,
  DevicesThirdPartyPluginErrorCode.valueMinus80005: -80005,
  DevicesThirdPartyPluginErrorCode.valueMinus80006: -80006,
  DevicesThirdPartyPluginErrorCode.valueMinus80007: -80007,
  DevicesThirdPartyPluginErrorCode.valueMinus80008: -80008,
  DevicesThirdPartyPluginErrorCode.valueMinus80009: -80009,
  DevicesThirdPartyPluginErrorCode.valueMinus80010: -80010,
  DevicesThirdPartyPluginErrorCode.valueMinus80011: -80011,
  DevicesThirdPartyPluginErrorCode.$unknown: r'$unknown',
};
