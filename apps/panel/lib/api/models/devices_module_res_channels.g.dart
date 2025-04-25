// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channels.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelsImpl _$$DevicesModuleResChannelsImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesModuleResChannelsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DevicesModuleResChannelsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DevicesModuleChannel.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DevicesModuleResChannelsImplToJson(
        _$DevicesModuleResChannelsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResChannelsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelsMethodEnumMap = {
  DevicesModuleResChannelsMethod.valueGet: 'GET',
  DevicesModuleResChannelsMethod.post: 'POST',
  DevicesModuleResChannelsMethod.patch: 'PATCH',
  DevicesModuleResChannelsMethod.delete: 'DELETE',
  DevicesModuleResChannelsMethod.$unknown: r'$unknown',
};
