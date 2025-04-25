// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channel_control.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelControlImpl
    _$$DevicesModuleResChannelControlImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResChannelControlImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResChannelControlMethod.fromJson(
              json['method'] as String),
          data: DevicesModuleChannelControl.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResChannelControlImplToJson(
        _$DevicesModuleResChannelControlImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResChannelControlMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelControlMethodEnumMap = {
  DevicesModuleResChannelControlMethod.valueGet: 'GET',
  DevicesModuleResChannelControlMethod.post: 'POST',
  DevicesModuleResChannelControlMethod.patch: 'PATCH',
  DevicesModuleResChannelControlMethod.delete: 'DELETE',
  DevicesModuleResChannelControlMethod.$unknown: r'$unknown',
};
