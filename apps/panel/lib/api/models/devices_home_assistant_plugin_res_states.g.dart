// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_res_states.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginResStatesImpl
    _$$DevicesHomeAssistantPluginResStatesImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginResStatesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesHomeAssistantPluginResStatesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DevicesHomeAssistantPluginState.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesHomeAssistantPluginResStatesImplToJson(
        _$DevicesHomeAssistantPluginResStatesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DevicesHomeAssistantPluginResStatesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesHomeAssistantPluginResStatesMethodEnumMap = {
  DevicesHomeAssistantPluginResStatesMethod.valueGet: 'GET',
  DevicesHomeAssistantPluginResStatesMethod.post: 'POST',
  DevicesHomeAssistantPluginResStatesMethod.patch: 'PATCH',
  DevicesHomeAssistantPluginResStatesMethod.delete: 'DELETE',
  DevicesHomeAssistantPluginResStatesMethod.$unknown: r'$unknown',
};
