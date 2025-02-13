// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_device_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDeviceControlImpl _$$DevicesResDeviceControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDeviceControlImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDeviceControlMethod.fromJson(json['method'] as String),
      data: DevicesDeviceControl.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDeviceControlImplToJson(
        _$DevicesResDeviceControlImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDeviceControlMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDeviceControlMethodEnumMap = {
  DevicesResDeviceControlMethod.valueGet: 'GET',
  DevicesResDeviceControlMethod.post: 'POST',
  DevicesResDeviceControlMethod.patch: 'PATCH',
  DevicesResDeviceControlMethod.delete: 'DELETE',
  DevicesResDeviceControlMethod.$unknown: r'$unknown',
};
