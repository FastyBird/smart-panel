// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device_channel.dart';
import 'devices_module_create_device_control.dart';
import 'devices_module_device_category.dart';

part 'devices_module_create_device.freezed.dart';
part 'devices_module_create_device.g.dart';

/// Schema for creating a new device. This includes essential attributes like type, category, and name, along with optional details such as a description.
@Freezed()
class DevicesModuleCreateDevice with _$DevicesModuleCreateDevice {
  const factory DevicesModuleCreateDevice({
    /// Unique identifier for the device. Optional during creation and system-generated if not provided.
    required String id,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesModuleDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesModuleCreateDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesModuleCreateDeviceChannel> channels,

    /// Optional detailed description of the device.
    String? description,

    /// Specifies the type of device.
    @Default('third-party')
    String type,
  }) = _DevicesModuleCreateDevice;
  
  factory DevicesModuleCreateDevice.fromJson(Map<String, Object?> json) => _$DevicesModuleCreateDeviceFromJson(json);
}
