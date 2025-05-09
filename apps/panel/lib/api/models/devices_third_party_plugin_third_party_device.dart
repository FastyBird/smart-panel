// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel.dart';
import 'devices_module_device_category.dart';
import 'devices_module_device_control.dart';

part 'devices_third_party_plugin_third_party_device.freezed.dart';
part 'devices_third_party_plugin_third_party_device.g.dart';

/// A third-party device used to communicate with third-party devices.
@Freezed()
class DevicesThirdPartyPluginThirdPartyDevice with _$DevicesThirdPartyPluginThirdPartyDevice {
  const factory DevicesThirdPartyPluginThirdPartyDevice({
    /// System-generated unique identifier for the device.
    required String id,

    /// Specifies the type of device.
    required String type,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesModuleDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// Optional detailed description of the device.
    required String? description,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesModuleDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesModuleChannel> channels,

    /// Timestamp indicating when the device was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp indicating when the device was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A url address of the third-party device endpoint.
    @JsonKey(name: 'service_address')
    required String serviceAddress,
  }) = _DevicesThirdPartyPluginThirdPartyDevice;
  
  factory DevicesThirdPartyPluginThirdPartyDevice.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginThirdPartyDeviceFromJson(json);
}
