// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channels.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelsImpl _$$DevicesResChannelsImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResChannelsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelsImplToJson(
        _$DevicesResChannelsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelsMethodEnumMap = {
  DevicesResChannelsMethod.valueGet: 'GET',
  DevicesResChannelsMethod.post: 'POST',
  DevicesResChannelsMethod.patch: 'PATCH',
  DevicesResChannelsMethod.delete: 'DELETE',
  DevicesResChannelsMethod.$unknown: r'$unknown',
};
