// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_channel.dart';
import 'devices_device_category.dart';
import 'devices_device_control.dart';

part 'devices_device_base.freezed.dart';
part 'devices_device_base.g.dart';

/// Represents the core attributes of a device, including its unique identifier, name, and category. This model forms the foundation for more detailed device representations, such as those including related entities (e.g., channels, properties, or controls).
@Freezed()
class DevicesDeviceBase with _$DevicesDeviceBase {
  const factory DevicesDeviceBase({
    /// System-generated unique identifier for the device.
    required String id,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// Optional detailed description of the device.
    required String? description,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesChannel> channels,

    /// Timestamp indicating when the device was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp indicating when the device was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DevicesDeviceBase;
  
  factory DevicesDeviceBase.fromJson(Map<String, Object?> json) => _$DevicesDeviceBaseFromJson(json);
}
