// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channel_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelControlImpl _$$DevicesResChannelControlImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelControlImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResChannelControlMethod.fromJson(json['method'] as String),
      data:
          DevicesChannelControl.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelControlImplToJson(
        _$DevicesResChannelControlImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelControlMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelControlMethodEnumMap = {
  DevicesResChannelControlMethod.valueGet: 'GET',
  DevicesResChannelControlMethod.post: 'POST',
  DevicesResChannelControlMethod.patch: 'PATCH',
  DevicesResChannelControlMethod.delete: 'DELETE',
  DevicesResChannelControlMethod.$unknown: r'$unknown',
};
