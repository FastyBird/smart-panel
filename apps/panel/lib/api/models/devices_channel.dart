// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_channel_category.dart';
import 'devices_channel_control.dart';
import 'devices_channel_property.dart';

part 'devices_channel.freezed.dart';
part 'devices_channel.g.dart';

/// Defines a functional unit of a device, such as a sensor, actuator, or informational component. Channels group related properties and controls for modular device functionality.
@Freezed()
class DevicesChannel with _$DevicesChannel {
  const factory DevicesChannel({
    /// System-generated unique identifier for the channel.
    required String id,

    /// Type of the channel, indicating its functional category (e.g., temperature, light).
    required DevicesChannelCategory category,

    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    required String? description,

    /// The parent device to which this channel belongs.
    required String device,

    /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
    required List<DevicesChannelControl> controls,

    /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
    required List<DevicesChannelProperty> properties,

    /// Timestamp when the channel was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp when the channel was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DevicesChannel;
  
  factory DevicesChannel.fromJson(Map<String, Object?> json) => _$DevicesChannelFromJson(json);
}
