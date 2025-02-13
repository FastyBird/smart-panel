// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_devices.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDevicesImpl _$$DevicesResDevicesImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDevicesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDevicesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) =>
              DevicesResDevicesDataUnion.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDevicesImplToJson(
        _$DevicesResDevicesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDevicesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDevicesMethodEnumMap = {
  DevicesResDevicesMethod.valueGet: 'GET',
  DevicesResDevicesMethod.post: 'POST',
  DevicesResDevicesMethod.patch: 'PATCH',
  DevicesResDevicesMethod.delete: 'DELETE',
  DevicesResDevicesMethod.$unknown: r'$unknown',
};
