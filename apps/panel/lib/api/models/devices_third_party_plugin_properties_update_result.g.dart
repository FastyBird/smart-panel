// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_properties_update_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginPropertiesUpdateResultImpl
    _$$DevicesThirdPartyPluginPropertiesUpdateResultImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginPropertiesUpdateResultImpl(
          properties: (json['properties'] as List<dynamic>)
              .map((e) => DevicesThirdPartyPluginPropertyUpdateResult.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginPropertiesUpdateResultImplToJson(
        _$DevicesThirdPartyPluginPropertiesUpdateResultImpl instance) =>
    <String, dynamic>{
      'properties': instance.properties,
    };
