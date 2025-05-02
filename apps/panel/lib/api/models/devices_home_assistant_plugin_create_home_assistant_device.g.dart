// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_create_home_assistant_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl
    _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          category:
              DevicesModuleDeviceCategory.fromJson(json['category'] as String),
          name: json['name'] as String,
          controls: (json['controls'] as List<dynamic>)
              .map((e) => DevicesModuleCreateDeviceControl.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          channels: (json['channels'] as List<dynamic>)
              .map((e) => DevicesModuleCreateDeviceChannel.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          haDeviceId: json['ha_device_id'] as String,
          description: json['description'] as String?,
        );

Map<String,
    dynamic> _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplToJson(
        _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'category': _$DevicesModuleDeviceCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'controls': instance.controls,
      'channels': instance.channels,
      'ha_device_id': instance.haDeviceId,
      'description': instance.description,
    };

const _$DevicesModuleDeviceCategoryEnumMap = {
  DevicesModuleDeviceCategory.generic: 'generic',
  DevicesModuleDeviceCategory.airConditioner: 'air_conditioner',
  DevicesModuleDeviceCategory.airDehumidifier: 'air_dehumidifier',
  DevicesModuleDeviceCategory.airHumidifier: 'air_humidifier',
  DevicesModuleDeviceCategory.airPurifier: 'air_purifier',
  DevicesModuleDeviceCategory.alarm: 'alarm',
  DevicesModuleDeviceCategory.camera: 'camera',
  DevicesModuleDeviceCategory.door: 'door',
  DevicesModuleDeviceCategory.doorbell: 'doorbell',
  DevicesModuleDeviceCategory.fan: 'fan',
  DevicesModuleDeviceCategory.heater: 'heater',
  DevicesModuleDeviceCategory.lighting: 'lighting',
  DevicesModuleDeviceCategory.lock: 'lock',
  DevicesModuleDeviceCategory.media: 'media',
  DevicesModuleDeviceCategory.outlet: 'outlet',
  DevicesModuleDeviceCategory.pump: 'pump',
  DevicesModuleDeviceCategory.robotVacuum: 'robot_vacuum',
  DevicesModuleDeviceCategory.sensor: 'sensor',
  DevicesModuleDeviceCategory.speaker: 'speaker',
  DevicesModuleDeviceCategory.sprinkler: 'sprinkler',
  DevicesModuleDeviceCategory.switcher: 'switcher',
  DevicesModuleDeviceCategory.television: 'television',
  DevicesModuleDeviceCategory.thermostat: 'thermostat',
  DevicesModuleDeviceCategory.valve: 'valve',
  DevicesModuleDeviceCategory.windowCovering: 'window_covering',
  DevicesModuleDeviceCategory.$unknown: r'$unknown',
};
