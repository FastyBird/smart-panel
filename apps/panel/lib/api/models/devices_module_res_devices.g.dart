// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_devices.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResDevicesImpl _$$DevicesModuleResDevicesImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleResDevicesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesModuleResDevicesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesModuleDevice.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesModuleResDevicesImplToJson(
        _$DevicesModuleResDevicesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResDevicesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResDevicesMethodEnumMap = {
  DevicesModuleResDevicesMethod.valueGet: 'GET',
  DevicesModuleResDevicesMethod.post: 'POST',
  DevicesModuleResDevicesMethod.patch: 'PATCH',
  DevicesModuleResDevicesMethod.delete: 'DELETE',
  DevicesModuleResDevicesMethod.$unknown: r'$unknown',
};
