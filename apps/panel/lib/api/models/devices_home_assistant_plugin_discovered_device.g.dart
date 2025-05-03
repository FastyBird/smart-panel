// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_discovered_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginDiscoveredDeviceImpl
    _$$DevicesHomeAssistantPluginDiscoveredDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginDiscoveredDeviceImpl(
          id: json['id'] as String,
          name: json['name'] as String,
          entities: (json['entities'] as List<dynamic>)
              .map((e) => e as String)
              .toList(),
          adoptedDeviceId: json['adopted_device_id'] as String?,
          states: (json['states'] as List<dynamic>)
              .map((e) => DevicesHomeAssistantPluginState.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
        );

Map<String, dynamic> _$$DevicesHomeAssistantPluginDiscoveredDeviceImplToJson(
        _$DevicesHomeAssistantPluginDiscoveredDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'entities': instance.entities,
      'adopted_device_id': instance.adoptedDeviceId,
      'states': instance.states,
    };
