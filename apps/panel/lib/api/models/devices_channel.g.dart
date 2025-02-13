// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesChannelImpl _$$DevicesChannelImplFromJson(Map<String, dynamic> json) =>
    _$DevicesChannelImpl(
      id: json['id'] as String,
      category: DevicesChannelCategory.fromJson(json['category'] as String),
      name: json['name'] as String,
      description: json['description'] as String?,
      device: json['device'] as String,
      controls: (json['controls'] as List<dynamic>)
          .map((e) => DevicesChannelControl.fromJson(e as Map<String, dynamic>))
          .toList(),
      properties: (json['properties'] as List<dynamic>)
          .map(
              (e) => DevicesChannelProperty.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DevicesChannelImplToJson(
        _$DevicesChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesChannelCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'description': instance.description,
      'device': instance.device,
      'controls': instance.controls,
      'properties': instance.properties,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
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
