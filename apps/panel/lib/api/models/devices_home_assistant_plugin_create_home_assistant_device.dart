// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device_channel.dart';
import 'devices_module_create_device_control.dart';
import 'devices_module_device_category.dart';

part 'devices_home_assistant_plugin_create_home_assistant_device.freezed.dart';
part 'devices_home_assistant_plugin_create_home_assistant_device.g.dart';

/// The schema for creating a Home Assistant device.
@Freezed()
class DevicesHomeAssistantPluginCreateHomeAssistantDevice with _$DevicesHomeAssistantPluginCreateHomeAssistantDevice {
  const factory DevicesHomeAssistantPluginCreateHomeAssistantDevice({
    /// Unique identifier for the device. Optional during creation and system-generated if not provided.
    required String id,

    /// Specifies the type of device.
    required String type,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesModuleDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesModuleCreateDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesModuleCreateDeviceChannel> channels,

    /// A HA device instance identifier.
    @JsonKey(name: 'ha_device_id')
    required String haDeviceId,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesHomeAssistantPluginCreateHomeAssistantDevice;
  
  factory DevicesHomeAssistantPluginCreateHomeAssistantDevice.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceFromJson(json);
}
