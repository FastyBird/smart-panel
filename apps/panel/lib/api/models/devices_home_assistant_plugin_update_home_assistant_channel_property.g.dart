// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_update_home_assistant_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyImpl
    _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyImpl(
          type: json['type'] as String,
          haEntityId: json['ha_entity_id'] as String,
          haAttribute: json['ha_attribute'] as String,
          name: json['name'] as String?,
          unit: json['unit'] as String?,
          format: json['format'] as List<dynamic>?,
          invalid: json['invalid'],
          step: json['step'] as num?,
          value: json['value'],
        );

Map<String, dynamic>
    _$$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyImplToJson(
            _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyImpl
                instance) =>
        <String, dynamic>{
          'type': instance.type,
          'ha_entity_id': instance.haEntityId,
          'ha_attribute': instance.haAttribute,
          'name': instance.name,
          'unit': instance.unit,
          'format': instance.format,
          'invalid': instance.invalid,
          'step': instance.step,
          'value': instance.value,
        };
