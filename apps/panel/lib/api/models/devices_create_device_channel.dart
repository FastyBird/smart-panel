// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_channel_category.dart';
import 'devices_create_channel_control.dart';
import 'devices_create_channel_property.dart';

part 'devices_create_device_channel.freezed.dart';
part 'devices_create_device_channel.g.dart';

/// Schema for creating a new channel, representing a functional category of a device such as temperature, light, or motion.
@Freezed()
class DevicesCreateDeviceChannel with _$DevicesCreateDeviceChannel {
  const factory DevicesCreateDeviceChannel({
    /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
    required String id,

    /// Type of the channel, indicating its functional category (e.g., temperature, light).
    required DevicesChannelCategory category,

    /// Human-readable name of the channel.
    required String name,

    /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
    required List<DevicesCreateChannelControl> controls,

    /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
    required List<DevicesCreateChannelProperty> properties,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesCreateDeviceChannel;
  
  factory DevicesCreateDeviceChannel.fromJson(Map<String, Object?> json) => _$DevicesCreateDeviceChannelFromJson(json);
}
