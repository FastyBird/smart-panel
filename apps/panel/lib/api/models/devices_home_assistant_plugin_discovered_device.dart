// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_home_assistant_plugin_state.dart';

part 'devices_home_assistant_plugin_discovered_device.freezed.dart';
part 'devices_home_assistant_plugin_discovered_device.g.dart';

/// Represents a device discovered from a connected Home Assistant instance, including its associated entities and current states.
@Freezed()
class DevicesHomeAssistantPluginDiscoveredDevice with _$DevicesHomeAssistantPluginDiscoveredDevice {
  const factory DevicesHomeAssistantPluginDiscoveredDevice({
    /// Home Assistant device ID.
    required String id,

    /// Display name of the device.
    required String name,

    /// List of entity IDs belonging to the device.
    required List<String> entities,

    /// If adopted, the UUID of the corresponding panel device.
    @JsonKey(name: 'adopted_device_id')
    required String? adoptedDeviceId,

    /// Current states of all entities belonging to the device.
    required List<DevicesHomeAssistantPluginState> states,
  }) = _DevicesHomeAssistantPluginDiscoveredDevice;
  
  factory DevicesHomeAssistantPluginDiscoveredDevice.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginDiscoveredDeviceFromJson(json);
}
