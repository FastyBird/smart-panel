// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_third_party_plugin_third_party_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesThirdPartyPluginThirdPartyDeviceImpl
    _$$DevicesThirdPartyPluginThirdPartyDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesThirdPartyPluginThirdPartyDeviceImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          category:
              DevicesModuleDeviceCategory.fromJson(json['category'] as String),
          name: json['name'] as String,
          description: json['description'] as String?,
          controls: (json['controls'] as List<dynamic>)
              .map((e) => DevicesModuleDeviceControl.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          channels: (json['channels'] as List<dynamic>)
              .map((e) =>
                  DevicesModuleChannel.fromJson(e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          serviceAddress: json['service_address'] as String,
        );

Map<String, dynamic> _$$DevicesThirdPartyPluginThirdPartyDeviceImplToJson(
        _$DevicesThirdPartyPluginThirdPartyDeviceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'category': _$DevicesModuleDeviceCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'description': instance.description,
      'controls': instance.controls,
      'channels': instance.channels,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'service_address': instance.serviceAddress,
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
