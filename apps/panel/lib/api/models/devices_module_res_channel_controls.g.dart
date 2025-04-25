// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channel_controls.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelControlsImpl
    _$$DevicesModuleResChannelControlsImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResChannelControlsImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResChannelControlsMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DevicesModuleChannelControl.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResChannelControlsImplToJson(
        _$DevicesModuleResChannelControlsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DevicesModuleResChannelControlsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelControlsMethodEnumMap = {
  DevicesModuleResChannelControlsMethod.valueGet: 'GET',
  DevicesModuleResChannelControlsMethod.post: 'POST',
  DevicesModuleResChannelControlsMethod.patch: 'PATCH',
  DevicesModuleResChannelControlsMethod.delete: 'DELETE',
  DevicesModuleResChannelControlsMethod.$unknown: r'$unknown',
};
