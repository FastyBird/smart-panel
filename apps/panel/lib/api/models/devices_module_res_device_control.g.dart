// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_device_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResDeviceControlImpl
    _$$DevicesModuleResDeviceControlImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResDeviceControlImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResDeviceControlMethod.fromJson(
              json['method'] as String),
          data: DevicesModuleDeviceControl.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResDeviceControlImplToJson(
        _$DevicesModuleResDeviceControlImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResDeviceControlMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResDeviceControlMethodEnumMap = {
  DevicesModuleResDeviceControlMethod.valueGet: 'GET',
  DevicesModuleResDeviceControlMethod.post: 'POST',
  DevicesModuleResDeviceControlMethod.patch: 'PATCH',
  DevicesModuleResDeviceControlMethod.delete: 'DELETE',
  DevicesModuleResDeviceControlMethod.$unknown: r'$unknown',
};
