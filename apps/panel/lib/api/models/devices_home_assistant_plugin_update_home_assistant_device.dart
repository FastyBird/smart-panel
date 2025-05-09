// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_home_assistant_plugin_update_home_assistant_device.freezed.dart';
part 'devices_home_assistant_plugin_update_home_assistant_device.g.dart';

/// Schema for updating a Home Assistant device.
@Freezed()
class DevicesHomeAssistantPluginUpdateHomeAssistantDevice with _$DevicesHomeAssistantPluginUpdateHomeAssistantDevice {
  const factory DevicesHomeAssistantPluginUpdateHomeAssistantDevice({
    /// Specifies the type of device.
    required String type,

    /// Human-readable name of the device.
    required String name,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesHomeAssistantPluginUpdateHomeAssistantDevice;
  
  factory DevicesHomeAssistantPluginUpdateHomeAssistantDevice.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceFromJson(json);
}
