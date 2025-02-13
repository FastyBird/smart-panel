// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_device_channels.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResDeviceChannelsImpl _$$DevicesResDeviceChannelsImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResDeviceChannelsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesResDeviceChannelsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResDeviceChannelsImplToJson(
        _$DevicesResDeviceChannelsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResDeviceChannelsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResDeviceChannelsMethodEnumMap = {
  DevicesResDeviceChannelsMethod.valueGet: 'GET',
  DevicesResDeviceChannelsMethod.post: 'POST',
  DevicesResDeviceChannelsMethod.patch: 'PATCH',
  DevicesResDeviceChannelsMethod.delete: 'DELETE',
  DevicesResDeviceChannelsMethod.$unknown: r'$unknown',
};
