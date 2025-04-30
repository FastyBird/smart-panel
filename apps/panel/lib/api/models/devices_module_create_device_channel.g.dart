// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_create_device_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleCreateDeviceChannelImpl
    _$$DevicesModuleCreateDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesModuleCreateDeviceChannelImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          category:
              DevicesModuleChannelCategory.fromJson(json['category'] as String),
          name: json['name'] as String,
          controls: (json['controls'] as List<dynamic>)
              .map((e) => DevicesModuleCreateChannelControl.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          properties: (json['properties'] as List<dynamic>)
              .map((e) => DevicesModuleCreateChannelProperty.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          description: json['description'] as String?,
        );

Map<String, dynamic> _$$DevicesModuleCreateDeviceChannelImplToJson(
        _$DevicesModuleCreateDeviceChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'category': _$DevicesModuleChannelCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'controls': instance.controls,
      'properties': instance.properties,
      'description': instance.description,
    };

const _$DevicesModuleChannelCategoryEnumMap = {
  DevicesModuleChannelCategory.generic: 'generic',
  DevicesModuleChannelCategory.airParticulate: 'air_particulate',
  DevicesModuleChannelCategory.alarm: 'alarm',
  DevicesModuleChannelCategory.battery: 'battery',
  DevicesModuleChannelCategory.camera: 'camera',
  DevicesModuleChannelCategory.carbonDioxide: 'carbon_dioxide',
  DevicesModuleChannelCategory.carbonMonoxide: 'carbon_monoxide',
  DevicesModuleChannelCategory.contact: 'contact',
  DevicesModuleChannelCategory.cooler: 'cooler',
  DevicesModuleChannelCategory.deviceInformation: 'device_information',
  DevicesModuleChannelCategory.door: 'door',
  DevicesModuleChannelCategory.doorbell: 'doorbell',
  DevicesModuleChannelCategory.electricalEnergy: 'electrical_energy',
  DevicesModuleChannelCategory.electricalPower: 'electrical_power',
  DevicesModuleChannelCategory.fan: 'fan',
  DevicesModuleChannelCategory.flow: 'flow',
  DevicesModuleChannelCategory.heater: 'heater',
  DevicesModuleChannelCategory.humidity: 'humidity',
  DevicesModuleChannelCategory.illuminance: 'illuminance',
  DevicesModuleChannelCategory.leak: 'leak',
  DevicesModuleChannelCategory.light: 'light',
  DevicesModuleChannelCategory.lock: 'lock',
  DevicesModuleChannelCategory.mediaInput: 'media_input',
  DevicesModuleChannelCategory.mediaPlayback: 'media_playback',
  DevicesModuleChannelCategory.microphone: 'microphone',
  DevicesModuleChannelCategory.motion: 'motion',
  DevicesModuleChannelCategory.nitrogenDioxide: 'nitrogen_dioxide',
  DevicesModuleChannelCategory.occupancy: 'occupancy',
  DevicesModuleChannelCategory.outlet: 'outlet',
  DevicesModuleChannelCategory.ozone: 'ozone',
  DevicesModuleChannelCategory.pressure: 'pressure',
  DevicesModuleChannelCategory.robotVacuum: 'robot_vacuum',
  DevicesModuleChannelCategory.smoke: 'smoke',
  DevicesModuleChannelCategory.speaker: 'speaker',
  DevicesModuleChannelCategory.sulphurDioxide: 'sulphur_dioxide',
  DevicesModuleChannelCategory.switcher: 'switcher',
  DevicesModuleChannelCategory.television: 'television',
  DevicesModuleChannelCategory.temperature: 'temperature',
  DevicesModuleChannelCategory.thermostat: 'thermostat',
  DevicesModuleChannelCategory.valve: 'valve',
  DevicesModuleChannelCategory.volatileOrganicCompounds:
      'volatile_organic_compounds',
  DevicesModuleChannelCategory.windowCovering: 'window_covering',
  DevicesModuleChannelCategory.$unknown: r'$unknown',
};
