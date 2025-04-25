// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_properties_update_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginPropertiesUpdateRequestImpl
    _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl(
          properties: (json['properties'] as List<dynamic>)
              .map((e) => DevicesThirdPartyPluginPropertyUpdateRequest.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
        );

Map<String, dynamic>
    _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplToJson(
            _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl instance) =>
        <String, dynamic>{
          'properties': instance.properties,
        };
