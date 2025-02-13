// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_device_channel.dart';
import 'devices_create_device_control.dart';
import 'devices_device_category.dart';

part 'devices_create_third_party_device.freezed.dart';
part 'devices_create_third_party_device.g.dart';

/// Schema for creating a third-party device, including its type, category, and a third-party service address.
@Freezed()
class DevicesCreateThirdPartyDevice with _$DevicesCreateThirdPartyDevice {
  const factory DevicesCreateThirdPartyDevice({
    /// Unique identifier for the device. Optional during creation and system-generated if not provided.
    required String id,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesCreateDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesCreateDeviceChannel> channels,

    /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
    @JsonKey(name: 'service_address')
    required String serviceAddress,

    /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
    @Default('third-party')
    String type,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesCreateThirdPartyDevice;
  
  factory DevicesCreateThirdPartyDevice.fromJson(Map<String, Object?> json) => _$DevicesCreateThirdPartyDeviceFromJson(json);
}
