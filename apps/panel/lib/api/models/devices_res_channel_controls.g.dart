// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channel_controls.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelControlsImpl _$$DevicesResChannelControlsImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelControlsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DevicesResChannelControlsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesChannelControl.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelControlsImplToJson(
        _$DevicesResChannelControlsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelControlsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelControlsMethodEnumMap = {
  DevicesResChannelControlsMethod.valueGet: 'GET',
  DevicesResChannelControlsMethod.post: 'POST',
  DevicesResChannelControlsMethod.patch: 'PATCH',
  DevicesResChannelControlsMethod.delete: 'DELETE',
  DevicesResChannelControlsMethod.$unknown: r'$unknown',
};
