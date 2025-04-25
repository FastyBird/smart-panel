// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResDeviceImpl _$$DevicesModuleResDeviceImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleResDeviceImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesModuleResDeviceMethod.fromJson(json['method'] as String),
      data: DevicesModuleDevice.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesModuleResDeviceImplToJson(
        _$DevicesModuleResDeviceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResDeviceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResDeviceMethodEnumMap = {
  DevicesModuleResDeviceMethod.valueGet: 'GET',
  DevicesModuleResDeviceMethod.post: 'POST',
  DevicesModuleResDeviceMethod.patch: 'PATCH',
  DevicesModuleResDeviceMethod.delete: 'DELETE',
  DevicesModuleResDeviceMethod.$unknown: r'$unknown',
};
