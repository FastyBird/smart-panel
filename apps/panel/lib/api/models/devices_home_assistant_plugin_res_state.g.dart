// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_res_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginResStateImpl
    _$$DevicesHomeAssistantPluginResStateImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginResStateImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesHomeAssistantPluginResStateMethod.fromJson(
              json['method'] as String),
          data: DevicesHomeAssistantPluginState.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesHomeAssistantPluginResStateImplToJson(
        _$DevicesHomeAssistantPluginResStateImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DevicesHomeAssistantPluginResStateMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesHomeAssistantPluginResStateMethodEnumMap = {
  DevicesHomeAssistantPluginResStateMethod.valueGet: 'GET',
  DevicesHomeAssistantPluginResStateMethod.post: 'POST',
  DevicesHomeAssistantPluginResStateMethod.patch: 'PATCH',
  DevicesHomeAssistantPluginResStateMethod.delete: 'DELETE',
  DevicesHomeAssistantPluginResStateMethod.$unknown: r'$unknown',
};
