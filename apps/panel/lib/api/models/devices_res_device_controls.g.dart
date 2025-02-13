// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_device_controls.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDeviceControlsImpl _$$DevicesResDeviceControlsImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDeviceControlsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDeviceControlsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesDeviceControl.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDeviceControlsImplToJson(
        _$DevicesResDeviceControlsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDeviceControlsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDeviceControlsMethodEnumMap = {
  DevicesResDeviceControlsMethod.valueGet: 'GET',
  DevicesResDeviceControlsMethod.post: 'POST',
  DevicesResDeviceControlsMethod.patch: 'PATCH',
  DevicesResDeviceControlsMethod.delete: 'DELETE',
  DevicesResDeviceControlsMethod.$unknown: r'$unknown',
};
