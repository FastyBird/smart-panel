// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_res_discovered_devices.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginResDiscoveredDevicesImpl
    _$$DevicesHomeAssistantPluginResDiscoveredDevicesImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginResDiscoveredDevicesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesHomeAssistantPluginResDiscoveredDevicesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DevicesHomeAssistantPluginDiscoveredDevice.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic>
    _$$DevicesHomeAssistantPluginResDiscoveredDevicesImplToJson(
            _$DevicesHomeAssistantPluginResDiscoveredDevicesImpl instance) =>
        <String, dynamic>{
          'status': instance.status,
          'timestamp': instance.timestamp.toIso8601String(),
          'request_id': instance.requestId,
          'path': instance.path,
          'method':
              _$DevicesHomeAssistantPluginResDiscoveredDevicesMethodEnumMap[
                  instance.method]!,
          'data': instance.data,
          'metadata': instance.metadata,
        };

const _$DevicesHomeAssistantPluginResDiscoveredDevicesMethodEnumMap = {
  DevicesHomeAssistantPluginResDiscoveredDevicesMethod.valueGet: 'GET',
  DevicesHomeAssistantPluginResDiscoveredDevicesMethod.post: 'POST',
  DevicesHomeAssistantPluginResDiscoveredDevicesMethod.patch: 'PATCH',
  DevicesHomeAssistantPluginResDiscoveredDevicesMethod.delete: 'DELETE',
  DevicesHomeAssistantPluginResDiscoveredDevicesMethod.$unknown: r'$unknown',
};
