// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_device_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleDeviceControlImpl _$$DevicesModuleDeviceControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleDeviceControlImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      device: json['device'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DevicesModuleDeviceControlImplToJson(
        _$DevicesModuleDeviceControlImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'device': instance.device,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
