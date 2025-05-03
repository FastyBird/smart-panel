// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_res_discovered_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginResDiscoveredDeviceImpl
    _$$DevicesHomeAssistantPluginResDiscoveredDeviceImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginResDiscoveredDeviceImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesHomeAssistantPluginResDiscoveredDeviceMethod.fromJson(
              json['method'] as String),
          data: DevicesHomeAssistantPluginDiscoveredDevice.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesHomeAssistantPluginResDiscoveredDeviceImplToJson(
        _$DevicesHomeAssistantPluginResDiscoveredDeviceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesHomeAssistantPluginResDiscoveredDeviceMethodEnumMap[
          instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesHomeAssistantPluginResDiscoveredDeviceMethodEnumMap = {
  DevicesHomeAssistantPluginResDiscoveredDeviceMethod.valueGet: 'GET',
  DevicesHomeAssistantPluginResDiscoveredDeviceMethod.post: 'POST',
  DevicesHomeAssistantPluginResDiscoveredDeviceMethod.patch: 'PATCH',
  DevicesHomeAssistantPluginResDiscoveredDeviceMethod.delete: 'DELETE',
  DevicesHomeAssistantPluginResDiscoveredDeviceMethod.$unknown: r'$unknown',
};
