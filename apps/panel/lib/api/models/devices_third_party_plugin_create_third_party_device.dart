// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device_channel.dart';
import 'devices_module_create_device_control.dart';
import 'devices_module_device_category.dart';

part 'devices_third_party_plugin_create_third_party_device.freezed.dart';
part 'devices_third_party_plugin_create_third_party_device.g.dart';

/// The schema for creating a third-party device.
@Freezed()
class DevicesThirdPartyPluginCreateThirdPartyDevice with _$DevicesThirdPartyPluginCreateThirdPartyDevice {
  const factory DevicesThirdPartyPluginCreateThirdPartyDevice({
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

    /// A url address of the third-party device endpoint.
    @JsonKey(name: 'service_address')
    required String serviceAddress,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesThirdPartyPluginCreateThirdPartyDevice;
  
  factory DevicesThirdPartyPluginCreateThirdPartyDevice.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginCreateThirdPartyDeviceFromJson(json);
}
