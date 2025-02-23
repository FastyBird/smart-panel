// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_devices_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDevicesDataUnionThirdPartyImpl
    _$$DevicesResDevicesDataUnionThirdPartyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesResDevicesDataUnionThirdPartyImpl(
          id: json['id'] as String,
          category: DevicesDeviceCategory.fromJson(json['category'] as String),
          name: json['name'] as String,
          description: json['description'] as String?,
          controls: (json['controls'] as List<dynamic>)
              .map((e) =>
                  DevicesDeviceControl.fromJson(e as Map<String, dynamic>))
              .toList(),
          channels: (json['channels'] as List<dynamic>)
              .map((e) => DevicesChannel.fromJson(e as Map<String, dynamic>))
              .toList(),
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          serviceAddress: json['service_address'] as String,
          type: json['type'] as String? ?? 'third-party',
        );

Map<String, dynamic> _$$DevicesResDevicesDataUnionThirdPartyImplToJson(
        _$DevicesResDevicesDataUnionThirdPartyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesDeviceCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'description': instance.description,
      'controls': instance.controls,
      'channels': instance.channels,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'service_address': instance.serviceAddress,
      'type': instance.type,
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
