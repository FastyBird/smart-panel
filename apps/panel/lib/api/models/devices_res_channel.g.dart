// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelImpl _$$DevicesResChannelImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResChannelMethod.fromJson(json['method'] as String),
      data: DevicesChannel.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelImplToJson(
        _$DevicesResChannelImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelMethodEnumMap = {
  DevicesResChannelMethod.valueGet: 'GET',
  DevicesResChannelMethod.post: 'POST',
  DevicesResChannelMethod.patch: 'PATCH',
  DevicesResChannelMethod.delete: 'DELETE',
  DevicesResChannelMethod.$unknown: r'$unknown',
};
