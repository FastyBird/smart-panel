// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelImpl _$$DevicesModuleResChannelImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleResChannelImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesModuleResChannelMethod.fromJson(json['method'] as String),
      data: DevicesModuleChannel.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesModuleResChannelImplToJson(
        _$DevicesModuleResChannelImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResChannelMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelMethodEnumMap = {
  DevicesModuleResChannelMethod.valueGet: 'GET',
  DevicesModuleResChannelMethod.post: 'POST',
  DevicesModuleResChannelMethod.patch: 'PATCH',
  DevicesModuleResChannelMethod.delete: 'DELETE',
  DevicesModuleResChannelMethod.$unknown: r'$unknown',
};
