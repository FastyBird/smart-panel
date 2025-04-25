// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_property_update_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginPropertyUpdateRequestImpl
    _$$DevicesThirdPartyPluginPropertyUpdateRequestImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginPropertyUpdateRequestImpl(
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          value: json['value'],
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginPropertyUpdateRequestImplToJson(
        _$DevicesThirdPartyPluginPropertyUpdateRequestImpl instance) =>
    <String, dynamic>{
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'value': instance.value,
    };
