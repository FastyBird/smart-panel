// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_create_third_party_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginCreateThirdPartyDeviceImpl
    _$$DevicesThirdPartyPluginCreateThirdPartyDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginCreateThirdPartyDeviceImpl(
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
          serviceAddress: json['service_address'] as String,
          description: json['description'] as String?,
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginCreateThirdPartyDeviceImplToJson(
        _$DevicesThirdPartyPluginCreateThirdPartyDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'category': _$DevicesModuleDeviceCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'controls': instance.controls,
      'channels': instance.channels,
      'service_address': instance.serviceAddress,
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
