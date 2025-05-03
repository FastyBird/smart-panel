// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginStateImpl
    _$$DevicesHomeAssistantPluginStateImplFromJson(Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginStateImpl(
          entityId: json['entity_id'] as String,
          state: json['state'],
          attributes: json['attributes'],
          lastChanged: json['last_changed'] == null
              ? null
              : DateTime.parse(json['last_changed'] as String),
          lastReported: json['last_reported'] == null
              ? null
              : DateTime.parse(json['last_reported'] as String),
          lastUpdated: json['last_updated'] == null
              ? null
              : DateTime.parse(json['last_updated'] as String),
        );

Map<String, dynamic> _$$DevicesHomeAssistantPluginStateImplToJson(
        _$DevicesHomeAssistantPluginStateImpl instance) =>
    <String, dynamic>{
      'entity_id': instance.entityId,
      'state': instance.state,
      'attributes': instance.attributes,
      'last_changed': instance.lastChanged?.toIso8601String(),
      'last_reported': instance.lastReported?.toIso8601String(),
      'last_updated': instance.lastUpdated?.toIso8601String(),
    };
