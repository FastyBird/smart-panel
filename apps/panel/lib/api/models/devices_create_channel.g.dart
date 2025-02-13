// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_create_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesCreateChannelImpl _$$DevicesCreateChannelImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesCreateChannelImpl(
      id: json['id'] as String,
      category: DevicesChannelCategory.fromJson(json['category'] as String),
      name: json['name'] as String,
      controls: (json['controls'] as List<dynamic>)
          .map((e) =>
              DevicesCreateChannelControl.fromJson(e as Map<String, dynamic>))
          .toList(),
      properties: (json['properties'] as List<dynamic>)
          .map((e) =>
              DevicesCreateChannelProperty.fromJson(e as Map<String, dynamic>))
          .toList(),
      device: json['device'] as String,
      description: json['description'] as String?,
    );

Map<String, dynamic> _$$DevicesCreateChannelImplToJson(
        _$DevicesCreateChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesChannelCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'controls': instance.controls,
      'properties': instance.properties,
      'device': instance.device,
      'description': instance.description,
    };

const _$DevicesChannelCategoryEnumMap = {
  DevicesChannelCategory.generic: 'generic',
  DevicesChannelCategory.airParticulate: 'air_particulate',
  DevicesChannelCategory.alarm: 'alarm',
  DevicesChannelCategory.battery: 'battery',
  DevicesChannelCategory.camera: 'camera',
  DevicesChannelCategory.carbonDioxide: 'carbon_dioxide',
  DevicesChannelCategory.carbonMonoxide: 'carbon_monoxide',
  DevicesChannelCategory.contact: 'contact',
  DevicesChannelCategory.cooler: 'cooler',
  DevicesChannelCategory.deviceInformation: 'device_information',
  DevicesChannelCategory.door: 'door',
  DevicesChannelCategory.doorbell: 'doorbell',
  DevicesChannelCategory.electricalEnergy: 'electrical_energy',
  DevicesChannelCategory.electricalPower: 'electrical_power',
  DevicesChannelCategory.fan: 'fan',
  DevicesChannelCategory.flow: 'flow',
  DevicesChannelCategory.heater: 'heater',
  DevicesChannelCategory.humidity: 'humidity',
  DevicesChannelCategory.illuminance: 'illuminance',
  DevicesChannelCategory.leak: 'leak',
  DevicesChannelCategory.light: 'light',
  DevicesChannelCategory.lock: 'lock',
  DevicesChannelCategory.mediaInput: 'media_input',
  DevicesChannelCategory.mediaPlayback: 'media_playback',
  DevicesChannelCategory.microphone: 'microphone',
  DevicesChannelCategory.motion: 'motion',
  DevicesChannelCategory.nitrogenDioxide: 'nitrogen_dioxide',
  DevicesChannelCategory.occupancy: 'occupancy',
  DevicesChannelCategory.outlet: 'outlet',
  DevicesChannelCategory.ozone: 'ozone',
  DevicesChannelCategory.pressure: 'pressure',
  DevicesChannelCategory.robotVacuum: 'robot_vacuum',
  DevicesChannelCategory.smoke: 'smoke',
  DevicesChannelCategory.speaker: 'speaker',
  DevicesChannelCategory.sulphurDioxide: 'sulphur_dioxide',
  DevicesChannelCategory.switcher: 'switcher',
  DevicesChannelCategory.television: 'television',
  DevicesChannelCategory.temperature: 'temperature',
  DevicesChannelCategory.thermostat: 'thermostat',
  DevicesChannelCategory.valve: 'valve',
  DevicesChannelCategory.volatileOrganicCompounds: 'volatile_organic_compounds',
  DevicesChannelCategory.windowCovering: 'window_covering',
  DevicesChannelCategory.$unknown: r'$unknown',
};
