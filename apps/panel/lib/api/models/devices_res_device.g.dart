// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDeviceImpl _$$DevicesResDeviceImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDeviceImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDeviceMethod.fromJson(json['method'] as String),
      data: DevicesResDeviceDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDeviceImplToJson(
        _$DevicesResDeviceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDeviceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDeviceMethodEnumMap = {
  DevicesResDeviceMethod.valueGet: 'GET',
  DevicesResDeviceMethod.post: 'POST',
  DevicesResDeviceMethod.patch: 'PATCH',
  DevicesResDeviceMethod.delete: 'DELETE',
  DevicesResDeviceMethod.$unknown: r'$unknown',
};
