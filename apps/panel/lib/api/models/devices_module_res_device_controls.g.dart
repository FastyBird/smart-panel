// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_device_controls.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResDeviceControlsImpl
    _$$DevicesModuleResDeviceControlsImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResDeviceControlsImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResDeviceControlsMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DevicesModuleDeviceControl.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResDeviceControlsImplToJson(
        _$DevicesModuleResDeviceControlsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResDeviceControlsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResDeviceControlsMethodEnumMap = {
  DevicesModuleResDeviceControlsMethod.valueGet: 'GET',
  DevicesModuleResDeviceControlsMethod.post: 'POST',
  DevicesModuleResDeviceControlsMethod.patch: 'PATCH',
  DevicesModuleResDeviceControlsMethod.delete: 'DELETE',
  DevicesModuleResDeviceControlsMethod.$unknown: r'$unknown',
};
