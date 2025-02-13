// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_res_channel_properties.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesResChannelPropertiesImpl _$$DevicesResChannelPropertiesImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesResChannelPropertiesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DevicesResChannelPropertiesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map(
              (e) => DevicesChannelProperty.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesResChannelPropertiesImplToJson(
        _$DevicesResChannelPropertiesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesResChannelPropertiesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesResChannelPropertiesMethodEnumMap = {
  DevicesResChannelPropertiesMethod.valueGet: 'GET',
  DevicesResChannelPropertiesMethod.post: 'POST',
  DevicesResChannelPropertiesMethod.patch: 'PATCH',
  DevicesResChannelPropertiesMethod.delete: 'DELETE',
  DevicesResChannelPropertiesMethod.$unknown: r'$unknown',
};
