// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_device_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDeviceChannelImpl _$$DevicesResDeviceChannelImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDeviceChannelImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDeviceChannelMethod.fromJson(json['method'] as String),
      data: DevicesChannel.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDeviceChannelImplToJson(
        _$DevicesResDeviceChannelImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDeviceChannelMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDeviceChannelMethodEnumMap = {
  DevicesResDeviceChannelMethod.valueGet: 'GET',
  DevicesResDeviceChannelMethod.post: 'POST',
  DevicesResDeviceChannelMethod.patch: 'PATCH',
  DevicesResDeviceChannelMethod.delete: 'DELETE',
  DevicesResDeviceChannelMethod.$unknown: r'$unknown',
};
