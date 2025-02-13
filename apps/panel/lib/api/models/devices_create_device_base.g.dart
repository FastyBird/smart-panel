// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_create_device_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesCreateDeviceBaseImpl _$$DevicesCreateDeviceBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesCreateDeviceBaseImpl(
      id: json['id'] as String,
      category: DevicesDeviceCategory.fromJson(json['category'] as String),
      name: json['name'] as String,
      controls: (json['controls'] as List<dynamic>)
          .map((e) =>
              DevicesCreateDeviceControl.fromJson(e as Map<String, dynamic>))
          .toList(),
      channels: (json['channels'] as List<dynamic>)
          .map((e) =>
              DevicesCreateDeviceChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      description: json['description'] as String?,
    );

Map<String, dynamic> _$$DevicesCreateDeviceBaseImplToJson(
        _$DevicesCreateDeviceBaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesDeviceCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'controls': instance.controls,
      'channels': instance.channels,
      'description': instance.description,
    };

const _$DevicesDeviceCategoryEnumMap = {
  DevicesDeviceCategory.generic: 'generic',
  DevicesDeviceCategory.airConditioner: 'air_conditioner',
  DevicesDeviceCategory.airDehumidifier: 'air_dehumidifier',
  DevicesDeviceCategory.airHumidifier: 'air_humidifier',
  DevicesDeviceCategory.airPurifier: 'air_purifier',
  DevicesDeviceCategory.alarm: 'alarm',
  DevicesDeviceCategory.camera: 'camera',
  DevicesDeviceCategory.door: 'door',
  DevicesDeviceCategory.doorbell: 'doorbell',
  DevicesDeviceCategory.fan: 'fan',
  DevicesDeviceCategory.heater: 'heater',
  DevicesDeviceCategory.lighting: 'lighting',
  DevicesDeviceCategory.lock: 'lock',
  DevicesDeviceCategory.media: 'media',
  DevicesDeviceCategory.outlet: 'outlet',
  DevicesDeviceCategory.pump: 'pump',
  DevicesDeviceCategory.robotVacuum: 'robot_vacuum',
  DevicesDeviceCategory.sensor: 'sensor',
  DevicesDeviceCategory.speaker: 'speaker',
  DevicesDeviceCategory.sprinkler: 'sprinkler',
  DevicesDeviceCategory.switcher: 'switcher',
  DevicesDeviceCategory.television: 'television',
  DevicesDeviceCategory.thermostat: 'thermostat',
  DevicesDeviceCategory.valve: 'valve',
  DevicesDeviceCategory.windowCovering: 'window_covering',
  DevicesDeviceCategory.$unknown: r'$unknown',
};
