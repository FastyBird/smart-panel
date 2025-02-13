// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_device_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesDeviceControlImpl _$$DevicesDeviceControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesDeviceControlImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      device: json['device'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DevicesDeviceControlImplToJson(
        _$DevicesDeviceControlImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'device': instance.device,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
