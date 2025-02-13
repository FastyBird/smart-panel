// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelPropertyImpl _$$DevicesResChannelPropertyImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelPropertyImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DevicesResChannelPropertyMethod.fromJson(json['method'] as String),
      data:
          DevicesChannelProperty.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelPropertyImplToJson(
        _$DevicesResChannelPropertyImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelPropertyMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelPropertyMethodEnumMap = {
  DevicesResChannelPropertyMethod.valueGet: 'GET',
  DevicesResChannelPropertyMethod.post: 'POST',
  DevicesResChannelPropertyMethod.patch: 'PATCH',
  DevicesResChannelPropertyMethod.delete: 'DELETE',
  DevicesResChannelPropertyMethod.$unknown: r'$unknown',
};
